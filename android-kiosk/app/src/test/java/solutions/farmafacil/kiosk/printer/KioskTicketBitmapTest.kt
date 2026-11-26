package solutions.farmafacil.kiosk.printer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class KioskTicketBitmapTest {

    private fun payload(
        items: List<KioskTicketPayload.Item>,
        total: Double,
        status: String = "unpaid",
        qr: String = "https://app.farmafacil.solutions/k/p/abc123",
    ) = KioskTicketPayload(
        displayNumber = "0009",
        pharmacyName = "Farmacia Test",
        totalAmount = total,
        currency = "EUR",
        paymentStatus = status,
        items = items,
        qrPayload = qr,
    )

    @Test
    fun mapsTwoProductOrderWithoutBrandTextAndSinglePaymentMessage() {
        val content = KioskTicketBitmap.Content.fromPayload(
            payload(
                items = listOf(
                    KioskTicketPayload.Item("Champú", 1, 5.0, 5.0),
                    KioskTicketPayload.Item("Solar FPS50", 1, 7.5, 7.5),
                ),
                total = 12.5,
            ),
        )
        val texts = KioskTicketBitmap.visibleTexts(content)

        assertEquals("", content.brand)
        assertFalse(texts.contains(KioskTicketBitmap.BRAND))
        assertFalse(texts.contains("FARMAFÁCIL"))
        assertEquals("Farmacia Test", content.pharmacyName)
        assertEquals("Pedido 0009", content.headline)
        assertEquals("0009", content.ticketNumber)
        assertEquals(2, content.items.size)
        assertEquals("1× Champú", content.items[0].left)
        assertEquals("5,00 €", content.items[0].right)
        assertEquals("1× Solar FPS50", content.items[1].left)
        assertEquals("7,50 €", content.items[1].right)
        assertEquals("TOTAL: 12,50 €", content.totalLabel)

        // Encabezado: farmacia → Pedido N (sin marca de texto)
        assertEquals(listOf("Farmacia Test", "Pedido 0009"), texts.take(2))
        assertTrue(texts.contains("TOTAL: 12,50 €"))

        // Un único mensaje de pago
        assertNull(content.paymentLine)
        assertEquals(listOf("Pago pendiente en mostrador"), content.footerLines)
        assertEquals(1, texts.count { it == "Pago pendiente en mostrador" })
        assertFalse(texts.contains("Pago: Sin cobrar"))
        assertFalse(texts.contains("No cobrado en el kiosko"))
        assertFalse(texts.any { it.contains("unpaid") })
        assertFalse(texts.contains("PRUEBA GRANDE V2"))
        assertEquals(2, texts.count { it.startsWith("1× ") })
    }

    @Test
    fun zeroPriceItemsShowPendingValuation() {
        val content = KioskTicketBitmap.Content.fromPayload(
            payload(
                items = listOf(
                    KioskTicketPayload.Item("Receta A", 2, 0.0, 0.0),
                    KioskTicketPayload.Item("Agua", 1, 1.0, 1.0),
                ),
                total = 1.0,
            ),
        )
        val texts = KioskTicketBitmap.visibleTexts(content)
        assertEquals("Pendiente de valoración", content.items[0].right)
        assertEquals("1,00 €", content.items[1].right)
        assertFalse(texts.contains("0,00 €"))
        assertEquals("TOTAL: 1,00 €", content.totalLabel)

        val allPending = KioskTicketBitmap.Content.fromPayload(
            payload(
                items = listOf(KioskTicketPayload.Item("Receta", 1, 0.0, 0.0)),
                total = 0.0,
            ),
        )
        assertEquals("TOTAL: Pendiente de valoración", allPending.totalLabel)
        assertFalse(KioskTicketBitmap.visibleTexts(allPending).any { it.contains("0,00") })
    }

    @Test
    fun sloganAndQrCaptionPresentWhenQrPayloadSet() {
        val content = KioskTicketBitmap.Content.fromPayload(
            payload(
                items = listOf(KioskTicketPayload.Item("Agua", 1, 1.0, 1.0)),
                total = 1.0,
            ),
        )
        val texts = KioskTicketBitmap.visibleTexts(content)
        assertEquals("https://app.farmafacil.solutions/k/p/abc123", content.qrPayload)
        assertTrue(texts.contains("Consulta el estado de tu pedido"))
        assertEquals("Tu farmacia, más cerca de tus clientes", texts.last())
        assertTrue(
            texts.indexOf("Consulta el estado de tu pedido") < texts.indexOf(KioskTicketBitmap.SLOGAN),
        )
    }

    @Test
    fun qrBlockSkippedWhenQrPayloadBlank() {
        val content = KioskTicketBitmap.Content.fromPayload(
            payload(
                items = listOf(KioskTicketPayload.Item("Agua", 1, 1.0, 1.0)),
                total = 1.0,
                qr = "",
            ),
        )
        val texts = KioskTicketBitmap.visibleTexts(content)
        assertEquals("", content.qrPayload)
        assertFalse(texts.contains("Consulta el estado de tu pedido"))
        assertTrue(texts.contains("Tu farmacia, más cerca de tus clientes"))
        assertNull(KioskTicketQr.encodeMatrix(content.qrPayload))
    }

    @Test
    fun qrEncodesPayloadIntoMatrixWithCrispModules() {
        val matrix = KioskTicketQr.encodeMatrix("https://app.farmafacil.solutions/k/p/abc123")
        assertNotNull(matrix)
        matrix!!
        assertEquals(matrix.width, matrix.height)
        assertTrue(matrix.width >= 21)

        val printable = 576
        val target = KioskTicketQr.targetSize(printable, printable - 48)
        val ratio = KioskTicketQr.bitmapSize(matrix.width, target).toFloat() / printable
        assertTrue("qr ratio=$ratio", ratio in 0.40f..0.55f)
        assertTrue(KioskTicketQr.moduleScale(matrix.width, target) >= 4)
    }

    @Test
    fun paidTicketHasNoPendingFooter() {
        val content = KioskTicketBitmap.Content.fromPayload(
            payload(
                items = listOf(KioskTicketPayload.Item("Agua", 1, 1.0, 1.0)),
                total = 1.0,
                status = "paid",
            ),
        )
        assertEquals("Pago: Cobrado", content.paymentLine)
        assertTrue(content.footerLines.isEmpty())
        assertFalse(KioskTicketBitmap.visibleTexts(content).contains("Pago pendiente en mostrador"))
    }

    @Test
    fun paymentStatusLabelsMatchKioskReadableCopy() {
        assertEquals("Sin cobrar", KioskTicketBitmap.paymentStatusLabel("unpaid"))
        assertEquals("Pendiente de confirmar", KioskTicketBitmap.paymentStatusLabel("pending_confirmation"))
        assertEquals("Cobrado", KioskTicketBitmap.paymentStatusLabel("paid"))
        assertEquals("Reembolsado", KioskTicketBitmap.paymentStatusLabel("refunded"))
        assertEquals("Exento", KioskTicketBitmap.paymentStatusLabel("waived"))
        assertNull(KioskTicketBitmap.formatPaymentLine("unpaid"))
        assertEquals(listOf("Pago pendiente en mostrador"), KioskTicketBitmap.paymentFooterLines("unpaid"))
    }

    @Test
    fun formatMoneyUsesEuroSignForEur() {
        assertEquals("12,50 €", KioskTicketBitmap.formatMoney(12.5, "EUR"))
        assertEquals("4,00 USD", KioskTicketBitmap.formatMoney(4.0, "USD"))
    }

    @Test
    fun sampleDebugV2KeepsPhysicalMarkerWithoutBrandText() {
        val sample = KioskTicketBitmap.Content.sampleDebugV2()
        val texts = KioskTicketBitmap.visibleTexts(sample)
        assertEquals("PRUEBA GRANDE V2", sample.headline)
        assertEquals("", sample.brand)
        assertEquals("FF-0001", sample.ticketNumber)
        assertEquals("TOTAL: 12,50 €", sample.totalLabel)
        assertNull(sample.paymentLine)
        assertEquals(listOf("Pago pendiente en mostrador"), sample.footerLines)
        assertEquals(2, sample.items.size)
        assertTrue(texts.contains("PRUEBA GRANDE V2"))
        assertFalse(texts.contains("FARMAFÁCIL"))
        assertTrue(texts.contains("Consulta el estado de tu pedido"))
        assertTrue(texts.contains("Tu farmacia, más cerca de tus clientes"))
        assertFalse(texts.any { it.contains("Raster ES test") })
        assertFalse(texts.any { it.contains("Prueba raster ICOD") })
        // Pedido real no usa el marcador debug
        val real = KioskTicketBitmap.Content.fromPayload(
            payload(
                items = listOf(KioskTicketPayload.Item("Agua", 1, 1.0, 1.0)),
                total = 1.0,
                status = "paid",
                qr = "q",
            ),
        )
        assertFalse(KioskTicketBitmap.visibleTexts(real).contains("PRUEBA GRANDE V2"))
        assertEquals("Pago: Cobrado", real.paymentLine)
    }

    @Test
    fun logoTargetSizeLeavesSideMargins() {
        val w = IcodPrintableWidth.SDK_58MM_PRINTABLE_DOTS
        val logo = KioskTicketBitmap.logoTargetSize(w)
        assertTrue(logo in 96 until w)
        assertTrue(logo >= (w * 0.4f).toInt())
        assertTrue(w - logo >= 16)
    }

    @Test
    fun debugFacadeUsesSameSampleMarkers() {
        assertEquals("PRUEBA GRANDE V2", DebugSizeTicketBitmap.MARKER_TITLE)
        assertEquals(KioskTicketBitmap.BRAND, DebugSizeTicketBitmap.MARKER_BRAND)
        assertTrue(DebugSizeTicketBitmap.MARKER_BRAND_IN_LOGO)
        assertEquals("FF-0001", DebugSizeTicketBitmap.MARKER_TICKET)
        assertEquals("TOTAL: 12,50 €", DebugSizeTicketBitmap.MARKER_TOTAL)
        assertEquals(
            KioskTicketBitmap.Content.sampleDebugV2().headline,
            DebugSizeTicketBitmap.MARKER_TITLE,
        )
    }
}
