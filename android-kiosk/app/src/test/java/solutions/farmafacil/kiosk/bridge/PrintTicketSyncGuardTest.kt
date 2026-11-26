package solutions.farmafacil.kiosk.bridge

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Cubre el contrato síncrono de impresión sin WebView/USB:
 * origen, payload inválido y excepciones controladas → ACK (nunca throw).
 */
class PrintTicketSyncGuardTest {

    private val allowed = "app.farmafacil.solutions"

    /**
     * Réplica del guard síncrono de [KioskPrintBridge.printTicketGuarded] + try/catch,
     * aislada de Android WebView / PrinterAPI para JVM unit tests.
     */
    private fun syncAck(
        session: PrintOriginSession,
        payloadJson: String?,
        forceThrow: Boolean = false,
    ): String {
        return try {
            if (forceThrow) {
                throw IllegalStateException("simulated sync failure")
            }
            if (!session.isValidatedAllowed()) {
                return ack("forbidden", "forbidden", "Origen no permitido o aún no validado.")
            }
            if (payloadJson.isNullOrBlank()) {
                return ack("error", "invalid_payload", "Payload vacío.")
            }
            val parsed = solutions.farmafacil.kiosk.printer.KioskTicketPayload.parse(payloadJson)
            if (parsed is solutions.farmafacil.kiosk.printer.KioskTicketPayload.ParseResult.Err) {
                return ack("error", parsed.code, parsed.message)
            }
            ack("accepted", "queued", "Impresión encolada.")
        } catch (t: Throwable) {
            ack("error", "bridge_error", "Error interno del puente de impresión.")
        }
    }

    private fun ack(status: String, code: String, message: String): String {
        return JSONObject()
            .put("status", status)
            .put("code", code)
            .put("message", message)
            .toString()
    }

    @Test
    fun unauthorizedOrigin_returnsForbiddenAck() {
        val session = PrintOriginSession(allowed)
        val raw = syncAck(session, """{"displayNumber":"0001"}""")
        val json = JSONObject(raw)
        assertEquals("forbidden", json.getString("status"))
        assertEquals("forbidden", json.getString("code"))
    }

    @Test
    fun notYetValidated_returnsForbiddenAck() {
        val session = PrintOriginSession(allowed)
        // Sin validateMainFrameUrl → mismo tratamiento que no autorizado.
        val raw = syncAck(session, "{}")
        assertEquals("forbidden", JSONObject(raw).getString("code"))
    }

    @Test
    fun invalidPayload_afterAuthorizedOrigin() {
        val session = PrintOriginSession(allowed)
        assertTrue(session.validateMainFrameUrl("https://app.farmafacil.solutions/k"))
        val raw = syncAck(session, "{}")
        val json = JSONObject(raw)
        assertEquals("error", json.getString("status"))
        assertEquals("invalid_payload", json.getString("code"))
        assertNotEquals("accepted", json.getString("status"))
    }

    @Test
    fun emptyPayload_afterAuthorizedOrigin() {
        val session = PrintOriginSession(allowed)
        session.validateMainFrameUrl("https://app.farmafacil.solutions/k")
        val json = JSONObject(syncAck(session, "  "))
        assertEquals("invalid_payload", json.getString("code"))
    }

    @Test
    fun synchronousException_returnsBridgeErrorAck_notThrow() {
        val session = PrintOriginSession(allowed)
        session.validateMainFrameUrl("https://app.farmafacil.solutions/k")
        val raw = syncAck(session, "{}", forceThrow = true)
        val json = JSONObject(raw)
        assertEquals("error", json.getString("status"))
        assertEquals("bridge_error", json.getString("code"))
    }

    @Test
    fun navigationAway_blocksUntilRevalidated() {
        val session = PrintOriginSession(allowed)
        session.validateMainFrameUrl("https://app.farmafacil.solutions/k")
        session.invalidate() // onPageStarted
        val blocked = JSONObject(syncAck(session, "{}"))
        assertEquals("forbidden", blocked.getString("code"))

        session.validateMainFrameUrl("https://app.farmafacil.solutions/k")
        val after = JSONObject(syncAck(session, "{}"))
        assertEquals("invalid_payload", after.getString("code"))
    }
}
