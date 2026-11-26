package solutions.farmafacil.kiosk.printer

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.SystemClock
import android.util.Log
import com.szsicod.print.escpos.PrinterAPI
import com.szsicod.print.io.USBAPI
import com.szsicod.print.utils.BitmapUtils
import solutions.farmafacil.kiosk.R

/**
 * Conexión e impresión vía USB estándar del SDK ICOD 3.1.8.
 *
 * Camino de ticket: [USBAPI] + [PrinterAPI] + [printRasterBitmap] + feed + corte.
 * No usa UsbNativeAPI ni requiere root.
 */
class IcodUsbPrinter(
    private val context: Context,
) {
    private val usbManager: UsbManager =
        context.applicationContext.getSystemService(UsbManager::class.java)

    private val printer: PrinterAPI = PrinterAPI.getInstance()

    data class Result(
        val ok: Boolean,
        val message: String,
        val code: String = if (ok) "ok" else "error",
    )

    fun findPrinterDevice(): UsbDevice? {
        return usbManager.deviceList.values.firstOrNull { device ->
            device.vendorId == IcodPrinterIds.VENDOR_ID &&
                device.productId == IcodPrinterIds.PRODUCT_ID
        }
    }

    fun hasUsbPermission(): Boolean {
        val device = findPrinterDevice() ?: return false
        return usbManager.hasPermission(device)
    }

    /**
     * Debe ejecutarse fuera del hilo principal.
     * Reintenta una vez si el primer connect falla tras un breve sleep.
     */
    fun connect(maxAttempts: Int = 2): Result {
        ensureImageNativeLoaded()
        val device = findPrinterDevice()
            ?: return Result(
                false,
                "Impresora desconectada: no hay ICOD_Thermal_Printer (VID 0483 / PID 7540).",
                "printer_disconnected",
            )

        if (!usbManager.hasPermission(device)) {
            return Result(
                false,
                "Sin permiso USB para la impresora. Concédelo y reintenta.",
                "usb_permission_required",
            )
        }

        var lastMessage = "connect falló"
        repeat(maxAttempts.coerceAtLeast(1)) { attempt ->
            val result = connectOnce(device)
            if (result.ok) return result
            lastMessage = result.message
            Log.w(TAG, "connect attempt ${attempt + 1} failed: $lastMessage")
            if (attempt < maxAttempts - 1) {
                SystemClock.sleep(500)
            }
        }
        return Result(false, lastMessage, "connect_failed")
    }

    private fun connectOnce(device: UsbDevice): Result {
        return try {
            if (printer.isConnect) {
                printer.disconnect()
                SystemClock.sleep(300)
            }
            val io = USBAPI(context.applicationContext, device)
            val ret = printer.connect(io)
            if (ret == PrinterAPI.SUCCESS && printer.isConnect) {
                SystemClock.sleep(1000)
                Result(
                    true,
                    "Conectado USBAPI · ${device.deviceName} · VID=${device.vendorId} PID=${device.productId}",
                    "ok",
                )
            } else {
                Result(
                    false,
                    "connect() falló con código $ret (0=OK, -1=fail, -2=no device).",
                    "connect_failed",
                )
            }
        } catch (t: Throwable) {
            Log.e(TAG, "connect failed", t)
            Result(false, "Excepción al conectar: ${t.javaClass.simpleName}: ${t.message}", "connect_failed")
        }
    }

    fun disconnect(): Result {
        return try {
            if (printer.isConnect) {
                printer.disconnect()
            }
            Result(true, "Desconectado.")
        } catch (t: Throwable) {
            Log.e(TAG, "disconnect failed", t)
            Result(false, "Error al desconectar: ${t.message}")
        }
    }

    fun isConnected(): Boolean = printer.isConnect

    /**
     * Recibo de prueba **debug** (marcador PRUEBA GRANDE V2):
     * mismo renderer de producción ([KioskTicketBitmap]) + camino raster validado.
     */
    fun printSpanishTestReceipt(): Result {
        return printBitmapTicket(
            label = "PRUEBA GRANDE V2",
            content = KioskTicketBitmap.Content.sampleDebugV2(),
        )
    }

    /**
     * Ticket de pedido real: bitmap con tipografía validada (V2).
     * Conserva el contrato [KioskTicketPayload] (orden de ítems e importes del payload).
     * No usa ASCII legacy ni altera el bridge.
     */
    fun printKioskTicket(payload: KioskTicketPayload): Result {
        return printBitmapTicket(
            label = "ticket pedido",
            content = KioskTicketBitmap.Content.fromPayload(payload),
        )
    }

    /**
     * Conecta (con reintento), imprime ticket y deja la sesión USB abierta
     * (el caller puede disconnect). Si no hay permiso/dispositivo, no intenta imprimir.
     */
    fun connectAndPrintTicket(payload: KioskTicketPayload): Result {
        val connected = if (printer.isConnect) {
            Result(true, "Ya conectado.", "ok")
        } else {
            connect(maxAttempts = 2)
        }
        if (!connected.ok) return connected
        val printed = printKioskTicket(payload)
        if (!printed.ok) {
            try {
                disconnect()
            } catch (_: Throwable) {
            }
        }
        return printed
    }

    /**
     * Camino validado: ancho SDK → [KioskTicketBitmap] → printRasterBitmap → feed → corte.
     */
    private fun printBitmapTicket(
        label: String,
        content: KioskTicketBitmap.Content,
    ): Result {
        if (!printer.isConnect) {
            return Result(false, "No hay conexión USB con la impresora.", "not_connected")
        }
        return try {
            ensureImageNativeLoaded()
            val widthDots = IcodPrintableWidth.resolveDots(context, printer)
            val logo = loadTicketLogo()
            val ticket = KioskTicketBitmap.render(widthDots, content, logo)
            val printable = BitmapUtils.reSizeByWidth(ticket, widthDots)

            printer.setAlignMode(1)
            printer.printRasterBitmap(printable)
            printer.setAlignMode(0)
            printer.printFeed()
            printer.printAndFeedPaper(80)
            val cutRet = printer.cutPaper(0x42, 0)

            val msg =
                "$label OK · raster ${printable.width}x${printable.height} · " +
                    "printableWidth=$widthDots · logo=${logo != null} · cut=$cutRet"
            recyclePair(ticket, printable)
            if (logo != null && !logo.isRecycled) logo.recycle()
            Result(true, msg, "ok")
        } catch (t: Throwable) {
            Log.e(TAG, "$label failed", t)
            Result(
                false,
                "Error $label: ${t.javaClass.simpleName}: ${t.message}",
                "print_failed",
            )
        }
    }

    /** Logo térmico desde vector oficial (drawable-nodpi). */
    private fun loadTicketLogo(): Bitmap? {
        return try {
            BitmapFactory.decodeResource(context.resources, R.drawable.ff_ticket_logo)
        } catch (t: Throwable) {
            Log.w(TAG, "ff_ticket_logo no cargado", t)
            null
        }
    }

    companion object {
        private const val TAG = "IcodUsbPrinter"

        @Volatile
        private var imageNativeLoaded = false

        private fun recyclePair(first: Bitmap, second: Bitmap) {
            if (!first.isRecycled) first.recycle()
            if (second !== first && !second.isRecycled) second.recycle()
        }

        /**
         * libimage_icod: JNI de BitmapUtils / rutas imagen-QR del SDK.
         * No cargamos libusb1.0 (UsbNativeAPI / root).
         */
        private fun ensureImageNativeLoaded() {
            if (imageNativeLoaded) return
            synchronized(this) {
                if (imageNativeLoaded) return
                try {
                    System.loadLibrary("image_icod")
                    imageNativeLoaded = true
                } catch (t: Throwable) {
                    Log.w(TAG, "libimage_icod no cargada", t)
                }
            }
        }
    }
}
