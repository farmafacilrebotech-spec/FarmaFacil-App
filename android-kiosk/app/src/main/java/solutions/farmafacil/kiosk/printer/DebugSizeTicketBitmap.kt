package solutions.farmafacil.kiosk.printer

import android.graphics.Bitmap

/**
 * Facade debug sobre [KioskTicketBitmap] (mismo renderer de producción + logo).
 * Marcadores inequívocos para comprobar en papel que se instaló el build correcto.
 * Wordmark: solo el logo circular (sin línea de texto «FARMAFÁCIL», igual que producción).
 */
object DebugSizeTicketBitmap {

    const val MARKER_TITLE = "PRUEBA GRANDE V2"
    /** Texto de marca ya no se imprime; se conserva solo como referencia. */
    const val MARKER_BRAND = KioskTicketBitmap.BRAND
    /** El logo circular también incluye la marca. */
    const val MARKER_BRAND_IN_LOGO = true
    const val MARKER_TICKET = "FF-0001"
    const val MARKER_TOTAL = "TOTAL: 12,50 €"

    fun render(widthDots: Int, logo: Bitmap? = null): Bitmap {
        return KioskTicketBitmap.render(
            widthDots,
            KioskTicketBitmap.Content.sampleDebugV2(),
            logo,
        )
    }
}
