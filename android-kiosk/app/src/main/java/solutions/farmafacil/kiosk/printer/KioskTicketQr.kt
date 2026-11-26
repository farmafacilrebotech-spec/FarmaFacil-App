package solutions.farmafacil.kiosk.printer

import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.WriterException
import com.google.zxing.common.BitMatrix
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/**
 * Codifica el `qrPayload` del ticket con ZXing (core) en un bitmap B/N nítido.
 * No inventa contenido: payload en blanco → sin QR.
 */
object KioskTicketQr {

    /** Fracción del ancho imprimible que ocupa el QR (45–55 %). */
    const val QR_WIDTH_RATIO = 0.50f

    /** Matriz de módulos (sin quiet zone; el ticket ya es blanco alrededor). */
    fun encodeMatrix(payload: String): BitMatrix? {
        val text = payload.trim()
        if (text.isEmpty()) return null
        return try {
            val hints = mapOf(
                EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
                EncodeHintType.MARGIN to 0,
                EncodeHintType.CHARACTER_SET to "UTF-8",
            )
            QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, 0, 0, hints)
        } catch (_: WriterException) {
            null
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    /** Lado objetivo del QR en dots para un ancho imprimible dado. */
    fun targetSize(widthDots: Int, maxSize: Int): Int {
        return (widthDots * QR_WIDTH_RATIO).toInt().coerceIn(64, maxSize.coerceAtLeast(64))
    }

    /** Píxeles por módulo (entero) para que el QR quede nítido en raster térmico. */
    fun moduleScale(matrixWidth: Int, targetSize: Int): Int {
        if (matrixWidth <= 0) return 1
        return (targetSize / matrixWidth).coerceAtLeast(1)
    }

    /** Lado final del bitmap (múltiplo entero del nº de módulos). */
    fun bitmapSize(matrixWidth: Int, targetSize: Int): Int {
        return matrixWidth * moduleScale(matrixWidth, targetSize)
    }

    /** Bitmap negro sobre blanco, escalado por enteros. */
    fun toBitmap(matrix: BitMatrix, targetSize: Int): Bitmap {
        val modules = matrix.width
        val scale = moduleScale(modules, targetSize)
        val size = modules * scale
        val pixels = IntArray(size * size)
        for (y in 0 until size) {
            val my = y / scale
            val row = y * size
            for (x in 0 until size) {
                pixels[row + x] = if (matrix.get(x / scale, my)) Color.BLACK else Color.WHITE
            }
        }
        return Bitmap.createBitmap(pixels, size, size, Bitmap.Config.ARGB_8888)
    }
}
