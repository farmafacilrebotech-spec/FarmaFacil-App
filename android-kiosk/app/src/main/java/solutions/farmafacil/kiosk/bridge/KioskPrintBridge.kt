package solutions.farmafacil.kiosk.bridge

import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject
import solutions.farmafacil.kiosk.BuildConfig
import solutions.farmafacil.kiosk.diagnostics.StagingPerfProbe
import solutions.farmafacil.kiosk.printer.IcodUsbPrinter
import solutions.farmafacil.kiosk.printer.KioskTicketPayload
import java.nio.charset.StandardCharsets
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Puente JS → nativo. Nombre en window: [JS_OBJECT_NAME].
 *
 * La web del kiosko (APK) llama `FarmaFacilKiosk.printTicket(json)` desde
 * el botón «Imprimir ticket». En navegador sin bridge se usa `window.print()`.
 *
 * Origen: no se lee [WebView.getUrl] desde el hilo de [@JavascriptInterface].
 * [MainActivity] invalida/valida [originSession] en el hilo UI.
 *
 * Ejecuta impresión en hilo de fondo; una sola cola (rechaza solapes).
 * Los errores no modifican el pedido en servidor.
 */
class KioskPrintBridge(
    private val webView: WebView,
    private val printer: IcodUsbPrinter,
    private val requestUsbPermission: () -> Unit,
    allowedHost: String,
    strictOrigin: Boolean = false,
    /** Inyectable en tests; en producción se crea con [allowedHost]. */
    internal val originSession: PrintOriginSession =
        PrintOriginSession(allowedHost, strict = strictOrigin),
) {
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val busy = AtomicBoolean(false)
    private var lastPrintAtMs = 0L

    /** Llamar desde el hilo UI al iniciar carga del frame principal. */
    fun onMainFrameNavigationStarted() {
        originSession.invalidate()
    }

    /**
     * Llamar desde el hilo UI cuando el frame principal termina de cargar.
     * Solo autoriza si el host de [url] está en la allowlist.
     */
    fun onMainFrameNavigationFinished(url: String?) {
        originSession.validateMainFrameUrl(url)
    }

    /** Llamar desde el hilo UI si el frame principal falla. */
    fun onMainFrameNavigationFailed() {
        originSession.invalidate()
    }

    @JavascriptInterface
    fun getBridgeInfo(): String {
        return try {
            JSONObject()
                .put("name", JS_OBJECT_NAME)
                .put("version", PrintBridgeContract.BRIDGE_VERSION)
                .put("nativeReady", PrintBridgeContract.NATIVE_READY)
                .put("webHookReady", PrintBridgeContract.WEB_HOOK_READY)
                .put("originReady", originSession.isValidatedAllowed())
                .toString()
        } catch (t: Throwable) {
            Log.e(TAG, "getBridgeInfo failed", t)
            """{"name":"$JS_OBJECT_NAME","error":"bridge_error"}"""
        }
    }

    /**
     * @param payloadJson ticket JSON (ver [KioskTicketPayload])
     * @return JSON inmediato `{status,code,message}` (aceptado / rechazado en cola).
     *         El resultado de impresión se notifica vía `FarmaFacilKioskPrintResult` en window.
     *
     * Nunca lanza hacia JS: cualquier fallo síncrono se convierte en ACK de error.
     */
    @JavascriptInterface
    fun printTicket(payloadJson: String?): String {
        return try {
            printTicketGuarded(payloadJson)
        } catch (t: Throwable) {
            // No registrar payload ni datos de pedido.
            Log.e(TAG, "printTicket synchronous failure type=${t.javaClass.simpleName}", t)
            try {
                busy.set(false)
            } catch (_: Throwable) {
            }
            ack("error", "bridge_error", "Error interno del puente de impresión.")
        }
    }

    private fun printTicketGuarded(payloadJson: String?): String {
        if (!originSession.isValidatedAllowed()) {
            return ack("forbidden", "forbidden", "Origen no permitido o aún no validado.")
        }
        if (payloadJson.isNullOrBlank()) {
            return ack("error", "invalid_payload", "Payload vacío.")
        }
        val now = System.currentTimeMillis()
        if (now - lastPrintAtMs < MIN_INTERVAL_MS) {
            return ack("error", "rate_limited", "Espera un momento antes de reimprimir.")
        }
        if (!busy.compareAndSet(false, true)) {
            return ack("error", "busy", "Ya hay una impresión en curso.")
        }

        val parsed = KioskTicketPayload.parse(payloadJson)
        if (parsed is KioskTicketPayload.ParseResult.Err) {
            busy.set(false)
            return ack("error", parsed.code, parsed.message)
        }
        val payload = (parsed as KioskTicketPayload.ParseResult.Ok).payload

        if (printer.findPrinterDevice() == null) {
            busy.set(false)
            return ack(
                "error",
                "printer_disconnected",
                "Impresora desconectada (VID 0483 / PID 7540).",
            )
        }
        if (!printer.hasUsbPermission()) {
            busy.set(false)
            mainHandler.post { requestUsbPermission() }
            return ack(
                "error",
                "usb_permission_required",
                "Se necesita permiso USB. Confirma el diálogo y pulsa Imprimir de nuevo.",
            )
        }

        lastPrintAtMs = now
        if (BuildConfig.ENABLE_PERF_PROBE) {
            StagingPerfProbe.markPrintStart()
        }
        executor.execute {
            val result = try {
                printer.connectAndPrintTicket(payload)
            } catch (t: Throwable) {
                Log.e(TAG, "printTicket async failure type=${t.javaClass.simpleName}", t)
                IcodUsbPrinter.Result(false, t.message ?: "error", "print_failed")
            }
            if (BuildConfig.ENABLE_PERF_PROBE) {
                StagingPerfProbe.markPrintEnd(result.ok, result.code)
            }
            busy.set(false)
            notifyWeb(result)
        }
        return ack("accepted", "queued", "Impresión encolada.")
    }

    fun shutdown() {
        executor.shutdownNow()
        originSession.invalidate()
        try {
            if (printer.isConnected()) printer.disconnect()
        } catch (_: Throwable) {
        }
    }

    private fun ack(status: String, code: String, message: String): String {
        return JSONObject()
            .put("status", status)
            .put("code", code)
            .put("message", message)
            .toString()
    }

    private fun notifyWeb(result: IcodUsbPrinter.Result) {
        val payload = JSONObject()
            .put("ok", result.ok)
            .put("code", result.code)
            .put("message", result.message)
            .toString()
        val b64 = Base64.encodeToString(
            payload.toByteArray(StandardCharsets.UTF_8),
            Base64.NO_WRAP,
        )
        val script =
            "(function(){try{" +
                "var d=JSON.parse(atob('$b64'));" +
                "window.FarmaFacilKioskPrintResult=d;" +
                "if(typeof window.onFarmaFacilKioskPrintResult==='function')" +
                "{window.onFarmaFacilKioskPrintResult(d);}" +
                "}catch(e){}})();"
        mainHandler.post {
            webView.evaluateJavascript(script, null)
        }
    }

    companion object {
        const val JS_OBJECT_NAME = "FarmaFacilKiosk"
        private const val TAG = "KioskPrintBridge"
        private const val MIN_INTERVAL_MS = 2_500L
    }
}
