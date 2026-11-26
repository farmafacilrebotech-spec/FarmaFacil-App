package solutions.farmafacil.kiosk.printer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class KioskTicketPayloadTest {

    @Test
    fun parsesWebTicketShapePreservingItemOrder() {
        val json =
            """
            {
              "displayNumber": "0009",
              "pharmacyName": "Farmacia Test",
              "totalAmount": 12.5,
              "currency": "EUR",
              "paymentStatus": "unpaid",
              "items": [
                {"productName": "Champú", "quantity": 1, "unitPrice": 5.0, "lineTotal": 5.0},
                {"productName": "Solar", "quantity": 1, "unitPrice": 7.5, "lineTotal": 7.5}
              ]
            }
            """.trimIndent()

        val parsed = KioskTicketPayload.parse(json)
        assertTrue(
            "expected Ok, got $parsed",
            parsed is KioskTicketPayload.ParseResult.Ok,
        )
        val payload = (parsed as KioskTicketPayload.ParseResult.Ok).payload
        assertEquals("0009", payload.displayNumber)
        assertEquals(12.5, payload.totalAmount, 0.001)
        assertEquals(2, payload.items.size)
        assertEquals("Champú", payload.items[0].productName)
        assertEquals("Solar", payload.items[1].productName)
        // Sin qrPayload no se inventa URL insegura.
        assertEquals("", payload.qrPayload)
    }

    @Test
    fun keepsProvidedQrPayload() {
        val json =
            """
            {
              "displayNumber": "0009",
              "pharmacyName": "Farmacia Test",
              "totalAmount": 5,
              "items": [{"productName": "A", "quantity": 1, "unitPrice": 5.0, "lineTotal": 5.0}],
              "qrPayload": "https://app.farmafacil.solutions/k/p/abc123"
            }
            """.trimIndent()
        val parsed = KioskTicketPayload.parse(json) as KioskTicketPayload.ParseResult.Ok
        assertEquals("https://app.farmafacil.solutions/k/p/abc123", parsed.payload.qrPayload)
    }

    @Test
    fun rejectsEmptyItems() {
        val json =
            """
            {
              "displayNumber": "1",
              "pharmacyName": "Farmacia",
              "totalAmount": 0,
              "currency": "EUR",
              "paymentStatus": "unpaid",
              "items": []
            }
            """.trimIndent()
        val parsed = KioskTicketPayload.parse(json)
        assertTrue(parsed is KioskTicketPayload.ParseResult.Err)
    }
}
