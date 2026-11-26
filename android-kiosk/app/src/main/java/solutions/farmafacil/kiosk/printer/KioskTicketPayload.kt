package solutions.farmafacil.kiosk.printer

import org.json.JSONArray
import org.json.JSONObject

/**
 * Payload de ticket alineado con el ticket web del kiosko (orden de líneas = orden del pedido).
 * El total mostrado es el del payload; no se recalcula ni se reordenan ítems.
 */
data class KioskTicketPayload(
    val displayNumber: String,
    val pharmacyName: String,
    val totalAmount: Double,
    val currency: String,
    val paymentStatus: String,
    val items: List<Item>,
    /** Contenido del QR (URL segura de seguimiento del web). Vacío → no se imprime QR. */
    val qrPayload: String = "",
) {
    data class Item(
        val productName: String,
        val quantity: Int,
        val unitPrice: Double,
        val lineTotal: Double,
    )

    companion object {
        private const val MAX_JSON_CHARS = 12_000
        private const val MAX_ITEMS = 40
        private const val MAX_NAME = 120
        private const val MAX_QR = 512

        fun parse(json: String): ParseResult {
            if (json.isBlank() || json.length > MAX_JSON_CHARS) {
                return ParseResult.Err("invalid_payload", "JSON vacío o demasiado grande.")
            }
            return try {
                val root = JSONObject(json)
                val displayNumber = root.optString("displayNumber").trim()
                val pharmacyName = root.optString("pharmacyName").trim()
                if (displayNumber.isEmpty() || displayNumber.length > 32) {
                    return ParseResult.Err("invalid_payload", "displayNumber no válido.")
                }
                if (pharmacyName.isEmpty() || pharmacyName.length > MAX_NAME) {
                    return ParseResult.Err("invalid_payload", "pharmacyName no válido.")
                }
                if (!root.has("totalAmount") || root.isNull("totalAmount")) {
                    return ParseResult.Err("invalid_payload", "Falta totalAmount.")
                }
                val totalAmount = root.getDouble("totalAmount")
                if (!totalAmount.isFinite() || totalAmount < 0 || totalAmount > 9_999_999.99) {
                    return ParseResult.Err("invalid_payload", "totalAmount fuera de rango.")
                }
                val currency = root.optString("currency", "EUR").trim().ifEmpty { "EUR" }
                if (currency.length > 8) {
                    return ParseResult.Err("invalid_payload", "currency no válida.")
                }
                val paymentStatus = root.optString("paymentStatus", "").trim().take(40)
                val itemsArr: JSONArray = root.optJSONArray("items")
                    ?: return ParseResult.Err("invalid_payload", "Falta items[].")
                if (itemsArr.length() == 0 || itemsArr.length() > MAX_ITEMS) {
                    return ParseResult.Err("invalid_payload", "items[] vacío o demasiado largo.")
                }
                val items = ArrayList<Item>(itemsArr.length())
                for (i in 0 until itemsArr.length()) {
                    val o = itemsArr.getJSONObject(i)
                    val name = o.optString("productName").trim()
                    if (name.isEmpty() || name.length > MAX_NAME) {
                        return ParseResult.Err("invalid_payload", "productName no válido en línea $i.")
                    }
                    val qty = o.getInt("quantity")
                    if (qty < 1 || qty > 99) {
                        return ParseResult.Err("invalid_payload", "quantity no válida en línea $i.")
                    }
                    val unit = o.getDouble("unitPrice")
                    val line = o.getDouble("lineTotal")
                    if (!unit.isFinite() || unit < 0 || unit > 9_999_999.99) {
                        return ParseResult.Err("invalid_payload", "unitPrice no válido en línea $i.")
                    }
                    if (!line.isFinite() || line < 0 || line > 9_999_999.99) {
                        return ParseResult.Err("invalid_payload", "lineTotal no válido en línea $i.")
                    }
                    items.add(Item(name, qty, unit, line))
                }
                val qrRaw = root.optString("qrPayload").trim()
                // Sin qrPayload → vacío (no se inventan URLs inseguras; el ticket omite el QR).
                val qrPayload = when {
                    qrRaw.isEmpty() -> ""
                    qrRaw.length <= MAX_QR -> qrRaw
                    else -> return ParseResult.Err("invalid_payload", "qrPayload demasiado largo.")
                }
                ParseResult.Ok(
                    KioskTicketPayload(
                        displayNumber = displayNumber,
                        pharmacyName = pharmacyName,
                        totalAmount = totalAmount,
                        currency = currency,
                        paymentStatus = paymentStatus,
                        items = items,
                        qrPayload = qrPayload,
                    ),
                )
            } catch (t: Throwable) {
                ParseResult.Err("invalid_payload", "JSON no válido: ${t.message}")
            }
        }
    }

    sealed class ParseResult {
        data class Ok(val payload: KioskTicketPayload) : ParseResult()
        data class Err(val code: String, val message: String) : ParseResult()
    }
}
