package solutions.farmafacil.kiosk.usb

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import solutions.farmafacil.kiosk.printer.IcodPrinterIds

/**
 * Solicitud de permiso USB para la impresora ICOD (VID/PID fijos).
 * No abre endpoints ni imprime.
 */
class UsbPermissionHelper(
    private val context: Context,
    private val onResult: (granted: Boolean, device: UsbDevice?) -> Unit,
) {
    private val usbManager: UsbManager =
        context.applicationContext.getSystemService(UsbManager::class.java)

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
            if (intent?.action != ACTION_USB_PERMISSION) return
            val device: UsbDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
            }
            val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
            onResult(granted, device)
        }
    }

    private var registered = false

    fun register() {
        if (registered) return
        val filter = IntentFilter(ACTION_USB_PERMISSION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(receiver, filter)
        }
        registered = true
    }

    fun unregister() {
        if (!registered) return
        try {
            context.unregisterReceiver(receiver)
        } catch (_: Throwable) {
        }
        registered = false
    }

    fun findIcodDevice(): UsbDevice? {
        return usbManager.deviceList.values.firstOrNull { device ->
            device.vendorId == IcodPrinterIds.VENDOR_ID &&
                device.productId == IcodPrinterIds.PRODUCT_ID
        }
    }

    fun hasPermission(device: UsbDevice? = findIcodDevice()): Boolean {
        val d = device ?: return false
        return usbManager.hasPermission(d)
    }

    /**
     * @return true si ya había permiso o se lanzó el diálogo; false si no hay impresora.
     */
    fun ensurePermission(): EnsureResult {
        val device = findIcodDevice()
            ?: return EnsureResult.NoDevice
        if (usbManager.hasPermission(device)) {
            return EnsureResult.AlreadyGranted(device)
        }
        val flags = PendingIntent.FLAG_MUTABLE
        val pi = PendingIntent.getBroadcast(
            context,
            0,
            Intent(ACTION_USB_PERMISSION).setPackage(context.packageName),
            flags,
        )
        usbManager.requestPermission(device, pi)
        return EnsureResult.Requested(device)
    }

    sealed class EnsureResult {
        data object NoDevice : EnsureResult()
        data class AlreadyGranted(val device: UsbDevice) : EnsureResult()
        data class Requested(val device: UsbDevice) : EnsureResult()
    }

    companion object {
        const val ACTION_USB_PERMISSION = "solutions.farmafacil.kiosk.USB_PERMISSION"
    }
}
