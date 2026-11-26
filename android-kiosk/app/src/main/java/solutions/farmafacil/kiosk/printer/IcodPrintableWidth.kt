package solutions.farmafacil.kiosk.printer

import android.content.Context
import android.util.Log
import com.szsicod.print.escpos.PrinterAPI
import solutions.farmafacil.kiosk.BuildConfig

/**
 * Resuelve el ancho raster (dots) que usará [printRasterBitmap].
 *
 * Orden:
 * 1. BuildConfig `ICOD_PRINTABLE_WIDTH_DOTS` si > 0
 * 2. SharedPreferences debug `printable_width_dots` si está en rango
 * 3. [PrinterAPI.getPrinterType]: 58 mm solo si es inequívoco; en cualquier otro caso
 *    (80, ambiguo, vacío, desconocido) → 80 mm (fórmulas del demo ICOD)
 *
 * Fórmulas del sample ICOD (`MainActivity` / `USBActivity`):
 * - 80 mm → (80 - 8) * 8
 * - 58 mm → (58 - 10) * 8
 */
object IcodPrintableWidth {
    private const val TAG = "IcodPrintableWidth"
    const val PREFS = "ff_kiosk_printer"
    const val KEY_WIDTH_DOTS = "printable_width_dots"

    /** Demo ICOD 58 mm (USBActivity). */
    val SDK_58MM_PRINTABLE_DOTS: Int = (58 - 10) * 8

    /** Demo ICOD 80 mm (MainActivity). */
    val SDK_80MM_PRINTABLE_DOTS: Int = (80 - 8) * 8

    private val WIDTH_RANGE = 192..832

    fun resolveDots(context: Context, printer: PrinterAPI): Int {
        val fromBuild = BuildConfig.ICOD_PRINTABLE_WIDTH_DOTS
        if (fromBuild in WIDTH_RANGE) {
            Log.i(TAG, "width from BuildConfig=$fromBuild")
            return fromBuild
        }

        val prefs = context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val fromPrefs = prefs.getInt(KEY_WIDTH_DOTS, 0)
        if (fromPrefs in WIDTH_RANGE) {
            Log.i(TAG, "width from prefs=$fromPrefs")
            return fromPrefs
        }

        val type = try {
            printer.getPrinterType().orEmpty().trim()
        } catch (t: Throwable) {
            Log.w(TAG, "getPrinterType failed", t)
            ""
        }
        Log.i(TAG, "getPrinterType='$type'")
        val dots = dotsFromPrinterType(type)
        Log.i(TAG, "resolved dots=$dots (80mm bias when ambiguous)")
        return dots
    }

    /**
     * Auto-detect con sesgo a 80 mm (K02): solo 58 mm si el tipo lo indica de forma
     * inequívoca (contiene «58» y no «80»). Vacío / desconocido / ambiguo → 80 mm.
     */
    fun dotsFromPrinterType(type: String): Int {
        val t = type.trim()
        val has58 = t.contains("58")
        val has80 = t.contains("80")
        return if (has58 && !has80) SDK_58MM_PRINTABLE_DOTS else SDK_80MM_PRINTABLE_DOTS
    }
}
