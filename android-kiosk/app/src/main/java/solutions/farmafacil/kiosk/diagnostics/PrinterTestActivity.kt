package solutions.farmafacil.kiosk.diagnostics

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import solutions.farmafacil.kiosk.BuildConfig
import solutions.farmafacil.kiosk.R
import solutions.farmafacil.kiosk.admin.DiagnosticAccessGate
import solutions.farmafacil.kiosk.databinding.ActivityPrinterTestBinding
import solutions.farmafacil.kiosk.printer.IcodUsbPrinter
import java.util.concurrent.Executors

/**
 * Prueba controlada de impresión ICOD (solo debug).
 *
 * Botón imprimir → [runPrint] → [IcodUsbPrinter.printSpanishTestReceipt]
 * → [DebugSizeTicketBitmap] → [PrinterAPI.printRasterBitmap].
 * No altera el WebView ni el flujo de pedidos.
 */
class PrinterTestActivity : AppCompatActivity() {

    private lateinit var binding: ActivityPrinterTestBinding
    private lateinit var printer: IcodUsbPrinter
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!DiagnosticAccessGate.isAllowed()) {
            Toast.makeText(this, R.string.diagnostics_release_blocked, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        binding = ActivityPrinterTestBinding.inflate(layoutInflater)
        setContentView(binding.root)
        printer = IcodUsbPrinter(this)

        appendLog(
            "Build ${BuildConfig.VERSION_NAME} · applicationId=${BuildConfig.APPLICATION_ID}\n" +
                "USBAPI (sin UsbNativeAPI) · VID 0483 / PID 7540\n" +
                "Botón → printSpanishTestReceipt → DebugSizeTicketBitmap → printRasterBitmap\n" +
                "Marcador papel: PRUEBA GRANDE V2\n" +
                "ICOD_PRINTABLE_WIDTH_DOTS=${BuildConfig.ICOD_PRINTABLE_WIDTH_DOTS} (0=auto)",
        )
        refreshDeviceHint()

        binding.connectButton.setOnClickListener { runConnect() }
        binding.printButton.setOnClickListener { runPrint() }
        binding.disconnectButton.setOnClickListener { runDisconnect() }
        binding.backButton.setOnClickListener { finish() }
    }

    override fun onDestroy() {
        executor.execute {
            try {
                if (printer.isConnected()) printer.disconnect()
            } catch (_: Throwable) {
            }
        }
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun refreshDeviceHint() {
        val device = printer.findPrinterDevice()
        if (device == null) {
            binding.statusText.text = getString(R.string.printer_test_device_missing)
        } else {
            binding.statusText.text = getString(
                R.string.printer_test_device_found,
                device.deviceName,
                device.vendorId,
                device.productId,
            )
        }
    }

    private fun runConnect() {
        setBusy(true)
        appendLog("Conectando (USBAPI, hasta 2 intentos)…")
        executor.execute {
            val result = printer.connect(maxAttempts = 2)
            mainHandler.post {
                setBusy(false)
                appendLog("[${result.code}] ${result.message}")
                Toast.makeText(this, result.message, Toast.LENGTH_SHORT).show()
                refreshDeviceHint()
            }
        }
    }

    private fun runPrint() {
        setBusy(true)
        appendLog("Imprimiendo PRUEBA GRANDE V2 (printSpanishTestReceipt → printRasterBitmap)…")
        executor.execute {
            val connect = if (printer.isConnected()) {
                IcodUsbPrinter.Result(true, "Ya conectado.", "ok")
            } else {
                printer.connect(maxAttempts = 2)
            }
            val result = if (!connect.ok) {
                connect
            } else {
                printer.printSpanishTestReceipt()
            }
            mainHandler.post {
                setBusy(false)
                appendLog("[${result.code}] ${result.message}")
                Toast.makeText(this, result.message, Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun runDisconnect() {
        setBusy(true)
        executor.execute {
            val result = printer.disconnect()
            mainHandler.post {
                setBusy(false)
                appendLog(result.message)
            }
        }
    }

    private fun setBusy(busy: Boolean) {
        binding.connectButton.isEnabled = !busy
        binding.printButton.isEnabled = !busy
        binding.disconnectButton.isEnabled = !busy
    }

    private fun appendLog(line: String) {
        val current = binding.logText.text?.toString().orEmpty()
        val next = if (current.isBlank()) line else "$current\n$line"
        binding.logText.text = next
    }
}
