package solutions.farmafacil.kiosk.printer

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class IcodPrintableWidthTest {
    @Test
    fun sdkFormulasMatchVendorSamples() {
        assertEquals(384, IcodPrintableWidth.SDK_58MM_PRINTABLE_DOTS)
        assertEquals(576, IcodPrintableWidth.SDK_80MM_PRINTABLE_DOTS)
        assertTrue(IcodPrintableWidth.SDK_58MM_PRINTABLE_DOTS < IcodPrintableWidth.SDK_80MM_PRINTABLE_DOTS)
    }

    @Test
    fun autoDetectBiasesTo80mm() {
        val d80 = IcodPrintableWidth.SDK_80MM_PRINTABLE_DOTS
        val d58 = IcodPrintableWidth.SDK_58MM_PRINTABLE_DOTS
        assertEquals(d80, IcodPrintableWidth.dotsFromPrinterType(""))
        assertEquals(d80, IcodPrintableWidth.dotsFromPrinterType("unknown"))
        assertEquals(d80, IcodPrintableWidth.dotsFromPrinterType("80mm"))
        assertEquals(d80, IcodPrintableWidth.dotsFromPrinterType("58/80"))
        assertEquals(d58, IcodPrintableWidth.dotsFromPrinterType("58mm"))
    }
}
