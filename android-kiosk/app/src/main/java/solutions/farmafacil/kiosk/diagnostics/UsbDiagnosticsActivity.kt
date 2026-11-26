package solutions.farmafacil.kiosk.diagnostics

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import solutions.farmafacil.kiosk.R
import solutions.farmafacil.kiosk.admin.DiagnosticAccessGate
import solutions.farmafacil.kiosk.databinding.ActivityUsbDiagnosticsBinding
import solutions.farmafacil.kiosk.usb.UsbDeviceInspector

/**
 * Pantalla técnica de diagnóstico USB (solo lectura).
 * Accesible únicamente en builds debug (gesto esquina + confirmación).
 *
 * Solicita permiso USB si hace falta; enumera VID/PID/interfaces/endpoints.
 * La prueba de impresión ICOD solo aparece en debug.
 */
class UsbDiagnosticsActivity : AppCompatActivity() {

    private lateinit var binding: ActivityUsbDiagnosticsBinding
    private lateinit var usbManager: UsbManager
    private var selectedDevice: UsbDevice? = null
    private var receiverRegistered = false

    private val permissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != ACTION_USB_PERMISSION) return
            val device: UsbDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
            }
            val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
            val msg = if (granted) {
                getString(R.string.diagnostics_permission_granted)
            } else {
                getString(R.string.diagnostics_permission_denied)
            }
            Toast.makeText(this@UsbDiagnosticsActivity, msg, Toast.LENGTH_SHORT).show()
            if (device != null) {
                selectedDevice = device
            }
            refreshReport()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (!DiagnosticAccessGate.isAllowed()) {
            Toast.makeText(this, R.string.diagnostics_release_blocked, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        binding = ActivityUsbDiagnosticsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        usbManager = getSystemService(UsbManager::class.java)

        val filter = IntentFilter(ACTION_USB_PERMISSION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(permissionReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(permissionReceiver, filter)
        }
        receiverRegistered = true

        binding.refreshButton.setOnClickListener { refreshReport() }
        binding.permissionButton.setOnClickListener { requestUsbPermission() }
        if (DiagnosticAccessGate.isAllowed()) {
            binding.printerTestButton.visibility = View.VISIBLE
            binding.printerTestButton.setOnClickListener {
                startActivity(Intent(this, PrinterTestActivity::class.java))
            }
        } else {
            binding.printerTestButton.visibility = View.GONE
        }
        binding.backButton.setOnClickListener { finish() }

        refreshReport()
    }

    override fun onDestroy() {
        if (receiverRegistered) {
            unregisterReceiver(permissionReceiver)
            receiverRegistered = false
        }
        super.onDestroy()
    }

    private fun refreshReport() {
        val report = UsbDeviceInspector.inspect(usbManager)
        selectedDevice = report.firstDevice
        binding.statusText.text = if (report.deviceCount == 0) {
            getString(R.string.diagnostics_empty)
        } else {
            "${report.deviceCount} dispositivo(s). Solo lectura — sin escritura USB."
        }
        binding.reportText.text = report.text.ifBlank { getString(R.string.diagnostics_empty) }
        binding.permissionButton.isEnabled = report.firstDevice != null
    }

    private fun requestUsbPermission() {
        val device = selectedDevice ?: run {
            Toast.makeText(this, R.string.diagnostics_empty, Toast.LENGTH_SHORT).show()
            return
        }
        if (usbManager.hasPermission(device)) {
            Toast.makeText(this, R.string.diagnostics_permission_granted, Toast.LENGTH_SHORT).show()
            refreshReport()
            return
        }
        val flags = PendingIntent.FLAG_MUTABLE
        val pi = PendingIntent.getBroadcast(
            this,
            0,
            Intent(ACTION_USB_PERMISSION).setPackage(packageName),
            flags
        )
        usbManager.requestPermission(device, pi)
    }

    companion object {
        private const val ACTION_USB_PERMISSION =
            "solutions.farmafacil.kiosk.USB_PERMISSION"
    }
}
