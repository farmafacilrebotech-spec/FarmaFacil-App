package solutions.farmafacil.kiosk.printer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Smoke tipográfico del layout V2 (JVM sin Canvas real).
 * El render en dispositivo lo valida la prueba ICOD física.
 */
class DebugSizeTicketBitmapTest {
    @Test
    fun markersAreUnmistakableV2() {
        assertEquals("PRUEBA GRANDE V2", DebugSizeTicketBitmap.MARKER_TITLE)
        assertEquals("FARMAFÁCIL", DebugSizeTicketBitmap.MARKER_BRAND)
        assertTrue(DebugSizeTicketBitmap.MARKER_BRAND_IN_LOGO)
        assertEquals("FF-0001", DebugSizeTicketBitmap.MARKER_TICKET)
        assertEquals("TOTAL: 12,50 €", DebugSizeTicketBitmap.MARKER_TOTAL)
        val texts = KioskTicketBitmap.visibleTexts(KioskTicketBitmap.Content.sampleDebugV2())
        assertFalse(texts.contains("FARMAFÁCIL"))
        assertTrue(texts.contains("PRUEBA GRANDE V2"))
    }

    @Test
    fun printableWidthConstantsAreUsableForTicket() {
        val w = IcodPrintableWidth.SDK_58MM_PRINTABLE_DOTS
        assertEquals(384, w)
        val titleSize = (w * 0.12f).coerceIn(38f, 58f)
        val totalSize = (w * 0.13f).coerceIn(40f, 64f)
        assertTrue(titleSize >= 38f)
        assertTrue(totalSize >= 40f)
        assertTrue(totalSize >= titleSize)
        val logo = KioskTicketBitmap.logoTargetSize(w)
        assertTrue(logo >= 150)
    }
}
