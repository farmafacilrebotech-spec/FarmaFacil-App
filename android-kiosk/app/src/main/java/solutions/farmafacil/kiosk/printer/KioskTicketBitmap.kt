package solutions.farmafacil.kiosk.printer

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Renderer de ticket kiosko (producción, papel 80 mm).
 * Tipografía V2 + logo oficial térmico (cruz/letras/anillo negros sobre blanco).
 * Usado por [IcodUsbPrinter.printKioskTicket] y por la prueba debug.
 *
 * Orden del ticket:
 * 1) logo circular centrado (sin texto «FARMAFÁCIL» debajo)
 * 2) nombre comercial de la farmacia
 * 3) «Pedido {displayNumber}» grande (o marcador debug)
 * 4) productos / cantidades / importes («Pendiente de valoración» si importe 0)
 * 5) total
 * 6) mensaje único de pago (p. ej. «Pago pendiente en mostrador»)
 * 7) QR grande centrado (solo si hay `qrPayload`) + «Consulta el estado de tu pedido»
 * 8) eslogan
 */
object KioskTicketBitmap {

    /** Marca de texto: ya NO se imprime en tickets (el logo la incluye). Solo referencia debug. */
    const val BRAND = "FARMAFÁCIL"

    const val PENDING_VALUATION = "Pendiente de valoración"
    const val PAYMENT_PENDING_COUNTER = "Pago pendiente en mostrador"
    const val QR_CAPTION = "Consulta el estado de tu pedido"
    const val SLOGAN = "Tu farmacia, más cerca de tus clientes"

    /** Diámetro del logo ≈ 48 % del ancho imprimible (márgenes laterales ≥ edge). */
    private const val LOGO_WIDTH_RATIO = 0.48f

    /** Margen lateral/vertical del ticket (fracción del ancho). */
    private const val MARGIN_RATIO = 0.05f

    data class ItemLine(
        val left: String,
        val right: String,
    )

    /**
     * Contenido ya mapeado desde el payload (o muestra debug).
     * No recalcula importes ni reordena ítems.
     */
    data class Content(
        val headline: String,
        /** Vacío en producción: el logo ya incluye la marca. */
        val brand: String = "",
        val pharmacyName: String,
        val ticketNumber: String,
        val items: List<ItemLine>,
        val totalLabel: String,
        val paymentLine: String? = null,
        val footerLines: List<String> = emptyList(),
        /** Contenido del QR; en blanco → no se dibuja el bloque QR. */
        val qrPayload: String = "",
        val qrCaption: String = QR_CAPTION,
        val slogan: String = SLOGAN,
    ) {
        companion object {
            /** Mapeo 1:1 del contrato [KioskTicketPayload] (orden de ítems preservado). */
            fun fromPayload(payload: KioskTicketPayload): Content {
                var anyPending = false
                val items = payload.items.map { item ->
                    val pending = isPendingValuation(item)
                    if (pending) anyPending = true
                    ItemLine(
                        left = "${item.quantity}× ${item.productName}",
                        right = if (pending) {
                            PENDING_VALUATION
                        } else {
                            formatMoney(item.lineTotal, payload.currency)
                        },
                    )
                }
                val totalLabel = if (anyPending && payload.totalAmount <= 0.0) {
                    "TOTAL: $PENDING_VALUATION"
                } else {
                    "TOTAL: ${formatMoney(payload.totalAmount, payload.currency)}"
                }
                return Content(
                    headline = "Pedido ${payload.displayNumber}",
                    brand = "",
                    pharmacyName = payload.pharmacyName,
                    ticketNumber = payload.displayNumber,
                    items = items,
                    totalLabel = totalLabel,
                    paymentLine = formatPaymentLine(payload.paymentStatus),
                    footerLines = paymentFooterLines(payload.paymentStatus),
                    qrPayload = payload.qrPayload,
                )
            }

            /**
             * Datos de ejemplo para la prueba física debug (mismo renderer).
             * «PRUEBA GRANDE V2» solo aquí — nunca en [fromPayload].
             */
            fun sampleDebugV2(): Content {
                return Content(
                    headline = "PRUEBA GRANDE V2",
                    brand = "",
                    pharmacyName = "Farmacia de prueba",
                    ticketNumber = "FF-0001",
                    items = listOf(
                        ItemLine("1× Ibuprofeno 400 mg", "4,50 €"),
                        ItemLine("1× Crema hidratante", "8,00 €"),
                    ),
                    totalLabel = "TOTAL: 12,50 €",
                    paymentLine = formatPaymentLine("unpaid"),
                    footerLines = paymentFooterLines("unpaid"),
                    qrPayload = "FARMAFACIL-DEBUG-QR",
                )
            }
        }
    }

    /** Importe 0 (precio unitario o total de línea) → pendiente de valoración. */
    fun isPendingValuation(item: KioskTicketPayload.Item): Boolean {
        return item.unitPrice <= 0.0 || item.lineTotal <= 0.0
    }

    /**
     * Etiqueta legible del estado de pago (misma semántica que [PAYMENT_STATUS_LABELS] web).
     * Nunca imprime el valor técnico crudo (`unpaid`, etc.).
     */
    fun paymentStatusLabel(status: String): String {
        return when (status.trim().lowercase(Locale.ROOT)) {
            "unpaid" -> "Sin cobrar"
            "pending_confirmation" -> "Pendiente de confirmar"
            "paid" -> "Cobrado"
            "refunded" -> "Reembolsado"
            "waived" -> "Exento"
            else -> status.trim().ifEmpty { "Sin cobrar" }
        }
    }

    private fun isUnpaid(status: String): Boolean {
        val s = status.trim().lowercase(Locale.ROOT)
        return s.isEmpty() || s == "unpaid"
    }

    /**
     * Línea de estado de pago. `null` si no está cobrado: el único mensaje es
     * [PAYMENT_PENDING_COUNTER] (ver [paymentFooterLines]).
     */
    fun formatPaymentLine(status: String): String? {
        if (isUnpaid(status)) return null
        return "Pago: ${paymentStatusLabel(status)}"
    }

    /** Mensaje único de pago cuando no se ha cobrado. */
    fun paymentFooterLines(status: String): List<String> {
        return if (isUnpaid(status)) listOf(PAYMENT_PENDING_COUNTER) else emptyList()
    }

    /** Textos visibles en orden de dibujo (para tests sin Canvas). */
    fun visibleTexts(content: Content): List<String> {
        return buildList {
            if (content.brand.isNotBlank()) add(content.brand)
            add(content.pharmacyName)
            add(content.headline)
            for (item in content.items) {
                add(item.left)
                add(item.right)
            }
            add(content.totalLabel)
            content.paymentLine?.let { add(it) }
            addAll(content.footerLines)
            if (content.qrPayload.isNotBlank()) add(content.qrCaption)
            if (content.slogan.isNotBlank()) add(content.slogan)
        }
    }

    fun formatMoney(amount: Double, currency: String): String {
        val cents = (amount * 100.0).roundToInt()
        val whole = cents / 100
        val frac = kotlin.math.abs(cents % 100)
        val body = String.format(Locale.GERMANY, "%d,%02d", whole, frac)
        return if (currency.equals("EUR", ignoreCase = true)) "$body €" else "$body $currency"
    }

    fun logoTargetSize(widthDots: Int): Int {
        val w = widthDots.coerceIn(192, 832)
        return (w * LOGO_WIDTH_RATIO).roundToInt().coerceIn(96, w - 16)
    }

    /**
     * @param logo bitmap B/N del vector oficial (opcional en unit tests JVM).
     */
    fun render(widthDots: Int, content: Content, logo: Bitmap? = null): Bitmap {
        val w = widthDots.coerceIn(192, 832)
        val margin = max(12, (w * MARGIN_RATIO).roundToInt())
        val contentWidth = (w - 2 * margin).toFloat()

        val brandPaint = paint(Typeface.BOLD, sizeFor(w, 0.07f, 22f, 34f))
        val pharmacyPaint = paint(Typeface.BOLD, sizeFor(w, 0.065f, 20f, 32f))
        // Pedido: lo más prominente del ticket.
        val headlinePaint = paint(Typeface.BOLD, sizeFor(w, 0.15f, 46f, 84f))
        val productPaint = paint(Typeface.NORMAL, sizeFor(w, 0.052f, 17f, 26f))
        val totalPaint = paint(Typeface.BOLD, sizeFor(w, 0.09f, 28f, 46f))
        val smallPaint = paint(Typeface.NORMAL, sizeFor(w, 0.045f, 15f, 22f))
        val payPaint = paint(Typeface.BOLD, sizeFor(w, 0.052f, 17f, 26f))
        val sloganPaint = paint(Typeface.BOLD, sizeFor(w, 0.045f, 15f, 24f))
        val rulePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            strokeWidth = max(3f, w / 120f)
            style = Paint.Style.STROKE
        }

        val gap = (pharmacyPaint.textSize * 0.7f).roundToInt().coerceAtLeast(10)
        val logoSize = if (logo != null && !logo.isRecycled) logoTargetSize(w) else 0
        val logoTopPad = if (logoSize > 0) gap else 0
        val logoBottomPad = if (logoSize > 0) (gap * 0.6f).roundToInt().coerceAtLeast(8) else 0
        val drawBrand = content.brand.isNotBlank()

        val qrMatrix = KioskTicketQr.encodeMatrix(content.qrPayload)
        val qrSize = if (qrMatrix != null) {
            KioskTicketQr.bitmapSize(
                qrMatrix.width,
                KioskTicketQr.targetSize(w, contentWidth.toInt()),
            )
        } else {
            0
        }

        fun h(paint: Paint) = lineHeight(paint)

        val rowWidth = contentWidth
        fun itemHeight(item: ItemLine): Int {
            var rowH = h(productPaint) + 2
            if (needsSecondLine(item, productPaint, rowWidth)) rowH += h(productPaint)
            return rowH
        }

        var measured = margin
        measured += logoTopPad
        measured += logoSize
        measured += logoBottomPad
        if (drawBrand) {
            measured += h(brandPaint)
            measured += gap / 3
        }
        measured += h(pharmacyPaint)
        measured += gap / 3
        measured += h(headlinePaint)
        measured += gap
        measured += 3 // rule
        measured += gap
        for (item in content.items) measured += itemHeight(item)
        if (content.items.isNotEmpty()) {
            measured += gap
            measured += 3
            measured += gap
        }
        measured += h(totalPaint)
        if (content.paymentLine != null) {
            measured += gap / 2
            measured += h(payPaint)
        }
        if (content.footerLines.isNotEmpty()) {
            measured += gap / 2
            measured += h(payPaint) * content.footerLines.size
        }
        if (qrMatrix != null) {
            measured += gap
            measured += qrSize
            measured += gap / 2
            measured += h(smallPaint)
        }
        if (content.slogan.isNotBlank()) {
            measured += gap
            measured += h(sloganPaint)
        }
        measured += margin

        val bitmap = Bitmap.createBitmap(w, measured.coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)

        val x0 = margin.toFloat()
        val x1 = (w - margin).toFloat()

        var y = margin.toFloat()
        if (logoSize > 0 && logo != null && !logo.isRecycled) {
            y += logoTopPad.toFloat()
            y = drawCenteredLogo(canvas, logo, w, y, logoSize)
            y += logoBottomPad.toFloat()
        } else {
            y += gap.toFloat()
        }

        if (drawBrand) {
            y = drawCenteredFit(canvas, content.brand, w, y, brandPaint, contentWidth)
            y += gap / 3f
        }
        y = drawCenteredFit(canvas, content.pharmacyName, w, y, pharmacyPaint, contentWidth)
        y += gap / 3f
        y = drawCenteredFit(canvas, content.headline, w, y, headlinePaint, contentWidth)
        y += gap.toFloat()

        canvas.drawLine(x0, y, x1, y, rulePaint)
        y += gap.toFloat()

        for (item in content.items) {
            y = drawProductRow(canvas, item, x0, x1, y, productPaint)
        }

        if (content.items.isNotEmpty()) {
            y += gap.toFloat()
            canvas.drawLine(x0, y, x1, y, rulePaint)
            y += gap.toFloat()
        }

        y = drawCenteredFit(canvas, content.totalLabel, w, y, totalPaint, contentWidth)

        content.paymentLine?.let { line ->
            y += gap / 2f
            y = drawCenteredFit(canvas, line, w, y, payPaint, contentWidth)
        }

        if (content.footerLines.isNotEmpty()) {
            y += gap / 2f
            for (footer in content.footerLines) {
                y = drawCenteredFit(canvas, footer, w, y, payPaint, contentWidth)
            }
        }

        if (qrMatrix != null) {
            y += gap.toFloat()
            val qrBitmap = KioskTicketQr.toBitmap(
                qrMatrix,
                KioskTicketQr.targetSize(w, contentWidth.toInt()),
            )
            val qx = ((w - qrBitmap.width) / 2f).coerceAtLeast(0f)
            // Sin filtro: módulos nítidos.
            canvas.drawBitmap(qrBitmap, qx, y, null)
            y += qrBitmap.height.toFloat()
            if (!qrBitmap.isRecycled) qrBitmap.recycle()
            y += gap / 2f
            y = drawCenteredFit(canvas, content.qrCaption, w, y, smallPaint, contentWidth)
        }

        if (content.slogan.isNotBlank()) {
            y += gap.toFloat()
            drawCenteredFit(canvas, content.slogan, w, y, sloganPaint, contentWidth)
        }

        return bitmap
    }

    private fun drawCenteredLogo(
        canvas: Canvas,
        logo: Bitmap,
        width: Int,
        top: Float,
        size: Int,
    ): Float {
        val left = ((width - size) / 2f).coerceAtLeast(0f)
        val dst = RectF(left, top, left + size, top + size)
        val src = Rect(0, 0, logo.width, logo.height)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        canvas.drawBitmap(logo, src, dst, paint)
        return top + size
    }

    private fun sizeFor(widthDots: Int, ratio: Float, min: Float, max: Float): Float {
        return (widthDots * ratio).coerceIn(min, max)
    }

    private fun paint(style: Int, size: Float): Paint {
        return Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK
            textSize = size
            typeface = Typeface.create(Typeface.SANS_SERIF, style)
            isFakeBoldText = style == Typeface.BOLD
            textAlign = Paint.Align.LEFT
        }
    }

    private fun lineHeight(paint: Paint): Int {
        val fm = paint.fontMetrics
        return (fm.descent - fm.ascent + fm.leading).roundToInt()
            .coerceAtLeast(paint.textSize.roundToInt() + 4)
    }

    /** Centra el texto; si no cabe en [maxWidth] reduce el tamaño (altura de línea = la del paint base). */
    private fun drawCenteredFit(
        canvas: Canvas,
        text: String,
        width: Int,
        top: Float,
        paint: Paint,
        maxWidth: Float,
    ): Float {
        val baseHeight = lineHeight(paint)
        val fit = Paint(paint)
        val minSize = max(10f, paint.textSize * 0.5f)
        while (fit.measureText(text) > maxWidth && fit.textSize > minSize) {
            fit.textSize = fit.textSize - 1f
        }
        val fm = fit.fontMetrics
        // Alinea por la parte superior del paint base para no desplazar líneas reducidas.
        val baseline = top - fm.ascent
        val textWidth = fit.measureText(text)
        val x = ((width - textWidth) / 2f).coerceAtLeast(0f)
        canvas.drawText(text, x, baseline, fit)
        return top + baseHeight
    }

    /** Importes largos («Pendiente de valoración») pasan a una segunda línea alineada a la derecha. */
    private fun needsSecondLine(item: ItemLine, paint: Paint, rowWidth: Float): Boolean {
        val rightW = paint.measureText(item.right)
        return rightW > rowWidth * 0.40f
    }

    private fun drawProductRow(
        canvas: Canvas,
        item: ItemLine,
        x0: Float,
        x1: Float,
        y: Float,
        paint: Paint,
    ): Float {
        val fm = paint.fontMetrics
        val rowWidth = x1 - x0
        val rightW = paint.measureText(item.right)
        val twoLines = needsSecondLine(item, paint, rowWidth)
        var cursor = y
        if (twoLines) {
            val leftText = ellipsize(item.left, paint, rowWidth)
            canvas.drawText(leftText, x0, cursor - fm.ascent, paint)
            cursor += lineHeight(paint)
            canvas.drawText(item.right, x1 - rightW, cursor - fm.ascent, paint)
        } else {
            val maxLeft = (rowWidth - rightW - 12f).coerceAtLeast(40f)
            val leftText = ellipsize(item.left, paint, maxLeft)
            canvas.drawText(leftText, x0, cursor - fm.ascent, paint)
            canvas.drawText(item.right, x1 - rightW, cursor - fm.ascent, paint)
        }
        return cursor + lineHeight(paint) + 2f
    }

    private fun ellipsize(text: String, paint: Paint, maxWidth: Float): String {
        if (paint.measureText(text) <= maxWidth) return text
        var end = text.length
        while (end > 1) {
            end--
            val candidate = text.take(end) + "…"
            if (paint.measureText(candidate) <= maxWidth) return candidate
        }
        return "…"
    }
}
