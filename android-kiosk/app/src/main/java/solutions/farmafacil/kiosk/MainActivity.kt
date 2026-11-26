package solutions.farmafacil.kiosk

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import solutions.farmafacil.kiosk.admin.DiagnosticAccessGate
import solutions.farmafacil.kiosk.bridge.KioskPrintBridge
import solutions.farmafacil.kiosk.bridge.PrintOriginPolicy
import solutions.farmafacil.kiosk.databinding.ActivityMainBinding
import solutions.farmafacil.kiosk.diagnostics.StagingPerfDiagnosticsActivity
import solutions.farmafacil.kiosk.diagnostics.StagingPerfProbe
import solutions.farmafacil.kiosk.diagnostics.UsbDiagnosticsActivity
import solutions.farmafacil.kiosk.locktask.KioskLockTaskController
import solutions.farmafacil.kiosk.printer.IcodUsbPrinter
import solutions.farmafacil.kiosk.usb.UsbPermissionHelper

/**
 * Contenedor WebView del kiosko.
 *
 * - Producción: https://app.farmafacil.solutions/k
 * - Staging (flavor): https://farmafacil-staging.vercel.app/k + banner + anti-prod
 * - Bridge [KioskPrintBridge] + ICOD USB
 * - Diagnóstico USB: debug o flavor staging
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var hasLoadedOnce = false
    private lateinit var lockTaskController: KioskLockTaskController
    private lateinit var printer: IcodUsbPrinter
    private var printBridge: KioskPrintBridge? = null
    private var usbPermissionHelper: UsbPermissionHelper? = null

    private var cornerTapCount = 0
    private var lastCornerTapAt = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (BuildConfig.ENABLE_PERF_PROBE) {
            StagingPerfProbe.markAppCreate()
        }
        enterFullscreen()

        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (BuildConfig.IS_STAGING) {
            binding.stagingBanner.visibility = View.VISIBLE
            Log.i(
                TAG,
                "STAGING APK package=${packageName} url=${BuildConfig.KIOSK_BASE_URL}",
            )
        }

        printer = IcodUsbPrinter(this)
        usbPermissionHelper = UsbPermissionHelper(this) { granted, _ ->
            val msg = if (granted) {
                getString(R.string.diagnostics_permission_granted)
            } else {
                getString(R.string.diagnostics_permission_denied)
            }
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
        }.also { it.register() }

        lockTaskController = KioskLockTaskController(this)
        Log.i(TAG, "Provisioning state: ${lockTaskController.describeProvisioningState()}")
        if (KioskLockTaskController.AUTO_START_ENABLED) {
            lockTaskController.tryStartLockTaskIfAuthorized(this, explicitOptIn = true)
        }

        setupWebView()
        if (BuildConfig.ENABLE_PERF_PROBE) {
            StagingPerfProbe.markWebViewReady()
        }
        setupOfflineUi()
        setupAdminCornerGesture()
        setupBackNavigation()
        registerNetworkCallback()

        if (isOnline()) {
            loadKiosk()
        } else {
            showOffline(true)
        }
    }

    override fun onResume() {
        super.onResume()
        enterFullscreen()
        binding.webView.onResume()
    }

    override fun onPause() {
        binding.webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        networkCallback?.let { callback ->
            connectivityManager?.unregisterNetworkCallback(callback)
        }
        printBridge?.shutdown()
        printBridge = null
        usbPermissionHelper?.unregister()
        usbPermissionHelper = null
        binding.webView.destroy()
        super.onDestroy()
    }

    private fun enterFullscreen() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility =
            (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(binding.webView, true)
        }

        binding.webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = false
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            // Permite al web detectar el WebView del APK (p. ej. dedupe del banner staging).
            if (!userAgentString.contains("FarmaFacilKiosk/")) {
                userAgentString = "$userAgentString FarmaFacilKiosk/${BuildConfig.VERSION_NAME}"
            }
        }

        printBridge = KioskPrintBridge(
            webView = binding.webView,
            printer = printer,
            requestUsbPermission = { requestPrinterUsbPermission() },
            allowedHost = BuildConfig.ALLOWED_ORIGIN_HOST,
            strictOrigin = BuildConfig.STRICT_ORIGIN,
        )
        binding.webView.addJavascriptInterface(
            printBridge!!,
            KioskPrintBridge.JS_OBJECT_NAME,
        )

        binding.webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                if (BuildConfig.ENABLE_PERF_PROBE) {
                    StagingPerfProbe.markConsoleLine(consoleMessage?.message())
                }
                return super.onConsoleMessage(consoleMessage)
            }
        }
        binding.webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?,
            ): Boolean {
                val host = request?.url?.host ?: return true
                if (BuildConfig.IS_STAGING && PrintOriginPolicy.isProductionHost(host)) {
                    Toast.makeText(
                        this@MainActivity,
                        R.string.staging_blocked_prod,
                        Toast.LENGTH_LONG,
                    ).show()
                    Log.w(TAG, "Blocked production navigation from staging APK: $host")
                    return true
                }
                val allowed = PrintOriginPolicy.isHostAllowed(
                    host,
                    BuildConfig.ALLOWED_ORIGIN_HOST,
                    strict = BuildConfig.STRICT_ORIGIN,
                )
                return !allowed
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                printBridge?.onMainFrameNavigationStarted()
                if (BuildConfig.ENABLE_PERF_PROBE) {
                    StagingPerfProbe.markPageStarted(url)
                }
                if (isOnline()) {
                    showOffline(false)
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                hasLoadedOnce = true
                CookieManager.getInstance().flush()
                printBridge?.onMainFrameNavigationFinished(url)
                if (BuildConfig.ENABLE_PERF_PROBE) {
                    StagingPerfProbe.markPageFinished(url, this@MainActivity)
                    view?.let { StagingPerfProbe.injectNavObserver(it) }
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?,
            ) {
                if (request?.isForMainFrame == true) {
                    printBridge?.onMainFrameNavigationFailed()
                    if (BuildConfig.ENABLE_PERF_PROBE) {
                        StagingPerfProbe.markNetworkError(
                            request.url?.toString(),
                            error?.description?.toString(),
                        )
                    }
                    showOffline(true)
                }
            }
        }
    }

    private fun requestPrinterUsbPermission() {
        when (usbPermissionHelper?.ensurePermission()) {
            is UsbPermissionHelper.EnsureResult.NoDevice ->
                Toast.makeText(this, R.string.printer_test_device_missing, Toast.LENGTH_LONG).show()
            is UsbPermissionHelper.EnsureResult.AlreadyGranted ->
                Toast.makeText(this, R.string.diagnostics_permission_granted, Toast.LENGTH_SHORT).show()
            is UsbPermissionHelper.EnsureResult.Requested ->
                Toast.makeText(this, R.string.print_usb_permission_prompt, Toast.LENGTH_LONG).show()
            null -> Unit
        }
    }

    private fun setupOfflineUi() {
        binding.retryButton.setOnClickListener {
            if (isOnline()) {
                loadKiosk()
            } else {
                Toast.makeText(this, R.string.offline_message, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun setupAdminCornerGesture() {
        binding.adminHotspot.setOnClickListener {
            val now = System.currentTimeMillis()
            if (now - lastCornerTapAt > 3000L) {
                cornerTapCount = 0
            }
            lastCornerTapAt = now
            cornerTapCount += 1
            if (cornerTapCount >= 5) {
                cornerTapCount = 0
                if (BuildConfig.IS_STAGING) {
                    openStagingAdminMenu()
                } else {
                    openDiagnosticsIfAllowed()
                }
            }
        }
    }

    private fun openStagingAdminMenu() {
        val items = mutableListOf(
            getString(R.string.staging_reload),
            getString(R.string.staging_exit_kiosk),
        )
        if (BuildConfig.ENABLE_PERF_PROBE) {
            items.add(getString(R.string.staging_open_perf))
        }
        if (DiagnosticAccessGate.isAllowed()) {
            items.add(getString(R.string.staging_open_diagnostics))
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.staging_menu_title)
            .setMessage(R.string.staging_menu_message)
            .setItems(items.toTypedArray()) { _, which ->
                when (items[which]) {
                    getString(R.string.staging_reload) -> loadKiosk()
                    getString(R.string.staging_exit_kiosk) -> exitToLauncher()
                    getString(R.string.staging_open_perf) ->
                        startActivity(Intent(this, StagingPerfDiagnosticsActivity::class.java))
                    getString(R.string.staging_open_diagnostics) ->
                        startActivity(Intent(this, UsbDiagnosticsActivity::class.java))
                }
            }
            .setNegativeButton(R.string.admin_gate_cancel, null)
            .show()
    }

    /**
     * Salida controlada del modo kiosko de pruebas (sin tocar Device Owner / Lock Task).
     * Solo flavor staging: lleva al launcher; la APK TEST permanece instalada.
     */
    private fun exitToLauncher() {
        val home = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(home)
        moveTaskToBack(true)
    }

    private fun openDiagnosticsIfAllowed() {
        if (!DiagnosticAccessGate.isAllowed()) {
            Toast.makeText(this, R.string.diagnostics_release_blocked, Toast.LENGTH_SHORT).show()
            return
        }
        AlertDialog.Builder(this)
            .setTitle(R.string.diagnostics_debug_title)
            .setMessage(R.string.diagnostics_debug_message)
            .setNegativeButton(R.string.admin_gate_cancel, null)
            .setPositiveButton(R.string.diagnostics_debug_open) { _, _ ->
                startActivity(Intent(this, UsbDiagnosticsActivity::class.java))
            }
            .show()
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (binding.webView.canGoBack()) {
                        binding.webView.goBack()
                    } else if (BuildConfig.IS_STAGING) {
                        // Staging: permitir salir al launcher con atrback en raíz.
                        exitToLauncher()
                    }
                }
            },
        )
    }

    private fun loadKiosk() {
        showOffline(false)
        val url = BuildConfig.KIOSK_BASE_URL
        if (BuildConfig.IS_STAGING) {
            val host = PrintOriginPolicy.hostFromUrl(url)
            if (PrintOriginPolicy.isProductionHost(host)) {
                Log.e(TAG, "Refusing to load production URL in staging APK: $url")
                Toast.makeText(this, R.string.staging_blocked_prod, Toast.LENGTH_LONG).show()
                return
            }
        }
        binding.webView.loadUrl(url)
    }

    private fun showOffline(show: Boolean) {
        binding.offlinePanel.visibility = if (show) View.VISIBLE else View.GONE
        binding.webView.visibility = if (show) View.INVISIBLE else View.VISIBLE
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(ConnectivityManager::class.java) ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun registerNetworkCallback() {
        connectivityManager = getSystemService(ConnectivityManager::class.java)
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread {
                    if (!hasLoadedOnce || binding.offlinePanel.visibility == View.VISIBLE) {
                        loadKiosk()
                    }
                }
            }

            override fun onLost(network: Network) {
                runOnUiThread {
                    if (!isOnline()) {
                        showOffline(true)
                    }
                }
            }
        }
        connectivityManager?.registerNetworkCallback(request, networkCallback!!)
    }

    companion object {
        private const val TAG = "FfKioskMain"
    }
}
