package solutions.farmafacil.kiosk.printer

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.io.FileOutputStream

/**
 * Exporta previsualizaciones 80 mm con el mismo [KioskTicketBitmap] que la impresión nativa.
 *
 * Activar con:
 *   EXPORT_TICKET_PREVIEWS=1 ./gradlew :app:testStagingDebugUnitTest --tests '*.KioskTicketPreviewExportTest'
 *
 * Destino por defecto: ~/Desktop (o TICKET_PREVIEW_DIR).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [30])
class KioskTicketPreviewExportTest {

    @Test
    fun exportKnownPricesAndPendingValuationPreviews() {
        assumeTrue(
            "Set EXPORT_TICKET_PREVIEWS=1 to write Desktop PNGs",
            System.getenv("EXPORT_TICKET_PREVIEWS") == "1",
        )

        val outDir = File(
            System.getenv("TICKET_PREVIEW_DIR")
                ?: (System.getProperty("user.home") + "/Desktop"),
        )
        outDir.mkdirs()

        val width = IcodPrintableWidth.SDK_80MM_PRINTABLE_DOTS
        val logo = loadMonoLogo()
        val qr =
            "https://farmafacil-staging.vercel.app/o/abcdefghijklmnopqrstuvwxyz0123456789ABCD"

        val known = KioskTicketBitmap.Content.fromPayload(
            KioskTicketPayload(
                displayNumber = "0187",
                pharmacyName = "Farmacia Fase7 QR Requests",
                totalAmount = 12.50,
                currency = "EUR",
                paymentStatus = "unpaid",
                items = listOf(
                    KioskTicketPayload.Item("Ibuprofeno 400 mg", 1, 4.50, 4.50),
                    KioskTicketPayload.Item("Crema hidratante", 1, 8.00, 8.00),
                ),
                qrPayload = qr,
            ),
        )
        writePng(
            File(outDir, "Ticket_Propuesta_Precios_Conocidos.png"),
            KioskTicketBitmap.render(width, known, logo),
        )

        val pending = KioskTicketBitmap.Content.fromPayload(
            KioskTicketPayload(
                displayNumber = "0188",
                pharmacyName = "Farmacia Fase7 QR Requests",
                totalAmount = 0.0,
                currency = "EUR",
                paymentStatus = "unpaid",
                items = listOf(
                    KioskTicketPayload.Item("Medicamento con receta", 1, 0.0, 0.0),
                    KioskTicketPayload.Item("Consulta farmacéutica", 1, 0.0, 0.0),
                ),
                qrPayload = qr,
            ),
        )
        writePng(
            File(outDir, "Ticket_Propuesta_Pendiente_Valoracion.png"),
            KioskTicketBitmap.render(width, pending, logo),
        )

        if (!logo.isRecycled) logo.recycle()
    }

    private fun loadMonoLogo(): Bitmap {
        val candidates = listOf(
            File("../branding/ticket-logo/ff_ticket_logo_thermal_512.png"),
            File("branding/ticket-logo/ff_ticket_logo_thermal_512.png"),
            File("../branding/ticket-logo/Logo_FarmaFacil_Ticket_Monocromo.png"),
            File("src/main/res/drawable-nodpi/ff_ticket_logo.png"),
        )
        for (file in candidates) {
            if (file.isFile) {
                val bmp = BitmapFactory.decodeFile(file.absolutePath)
                if (bmp != null) return bmp
            }
        }
        // Fallback: disco negro para no bloquear el layout si falta el asset.
        val size = 256
        val fallback = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        fallback.eraseColor(Color.BLACK)
        return fallback
    }

    private fun writePng(file: File, bitmap: Bitmap) {
        FileOutputStream(file).use { out ->
            check(bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)) {
                "No se pudo escribir ${file.name}"
            }
        }
        println("Wrote ${file.absolutePath} (${bitmap.width}x${bitmap.height})")
    }
}
