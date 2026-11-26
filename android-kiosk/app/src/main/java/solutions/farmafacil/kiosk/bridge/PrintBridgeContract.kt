package solutions.farmafacil.kiosk.bridge

/**
 * Contrato del puente JS↔nativo de impresión.
 *
 * ## Estado nativo (android-kiosk)
 * - [NATIVE_READY]=true: USBAPI + raster + QR + cut + bridge registrado.
 * - Objeto JS: [KioskPrintBridge.JS_OBJECT_NAME] → `printTicket(json)`, `getBridgeInfo()`.
 *
 * ## Estado web
 * - [WEB_HOOK_READY]=true: `components/kiosk/kiosk-cart-view.tsx` llama al puente
 *   si existe `window.FarmaFacilKiosk.printTicket`; si no, `window.print()`.
 *
 * ## Mapeo payload (web → nativo)
 * | Campo web (KioskTicketData) | Campo nativo |
 * |---|---|
 * | displayNumber | displayNumber |
 * | pharmacyName | pharmacyName |
 * | totalAmount | totalAmount (sin recalcular) |
 * | currency | currency |
 * | paymentStatus | paymentStatus |
 * | items[].productName/quantity/unitPrice/lineTotal | igual, mismo orden |
 * | (opcional) qrPayload | si falta/vacío → no se imprime QR |
 * | createdLabel | no se envía / se ignora |
 *
 * ## Seguridad (nativo)
 * 1. Origin allowlist (host kiosko / vercel preview).
 * 2. Interfaz mínima: `printTicket` / `getBridgeInfo`.
 * 3. Validación [solutions.farmafacil.kiosk.printer.KioskTicketPayload].
 * 4. Rate-limit + una sola impresión en cola.
 * 5. Métodos @JavascriptInterface concretos.
 * 6. Fallos de impresión no alteran el pedido (solo UI web).
 */
object PrintBridgeContract {
    const val BRIDGE_VERSION = 1
    const val NATIVE_READY = true
    const val WEB_HOOK_READY = true
    const val PHASE = 2

    /** Código listo; la validación física en POS sigue siendo necesaria. */
    const val IMPLEMENTED = true
}
