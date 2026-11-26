/**
 * Helpers de dibujo comunes a los carteles PDF (jsPDF).
 * Sin path aliases — testeable con node --experimental-strip-types.
 */

import type { jsPDF } from 'jspdf';

import { STAGING_POSTER_WATERMARK_TEXT } from './pharmacy-poster-meta.ts';

/**
 * Dibuja una imagen recortada a círculo (inscrito en el cuadrado dado).
 *
 * Los PNG oficiales del emblema FarmaFácil son cuadrados con fondo negro
 * opaco fuera del aro: sin recorte aparecen esquinas negras. Es el mismo
 * criterio que `BrandLogo` (UI): `rounded-full` + `overflow-hidden`, sin
 * tocar cruz, tipografía ni aro plateado.
 */
export function addImageClippedToCircle(
  doc: jsPDF,
  dataUrl: string,
  format: 'PNG' | 'JPEG',
  x: number,
  y: number,
  size: number
): void {
  doc.saveGraphicsState();
  try {
    // Trazado sin pintar (style null) → clip → descartar trazado.
    doc.circle(x + size / 2, y + size / 2, size / 2, null);
    doc.clip();
    doc.discardPath();
    doc.addImage(dataUrl, format, x, y, size, size, undefined, 'NONE');
  } finally {
    doc.restoreGraphicsState();
  }
}

/**
 * Marca de agua diagonal «PRUEBA - STAGING» (semitransparente).
 * Llamar ANTES de dibujar el QR para no degradar su lectura.
 */
export function drawStagingWatermark(
  doc: jsPDF,
  page: { widthMm: number; heightMm: number }
): void {
  const { widthMm: W, heightMm: H } = page;
  doc.saveGraphicsState();
  try {
    const gs = new (doc as unknown as {
      GState: new (o: { opacity: number }) => unknown;
    }).GState({ opacity: 0.22 });
    (doc as unknown as { setGState: (g: unknown) => void }).setGState(gs);
    doc.setFont('helvetica', 'bold');
    // Tamaño relativo al ancho de página (A4 ≈ 54 pt, A5/A3 proporcional).
    doc.setFontSize((W / 210) * 54);
    doc.setTextColor(214, 40, 40);
    // jsPDF no centra bien el texto girado: se calcula el punto de inicio
    // para que el centro del texto coincida con el centro de la página.
    const angleDeg = 55;
    const rad = (angleDeg * Math.PI) / 180;
    const textW = doc.getTextWidth(STAGING_POSTER_WATERMARK_TEXT);
    const fontMm = (doc.getFontSize() * 25.4) / 72;
    // Dirección del texto (y del PDF hacia abajo) y normal para centrar en vertical.
    const startX = W / 2 - (textW / 2) * Math.cos(rad) + (fontMm * 0.35) * Math.sin(rad);
    const startY = H / 2 + (textW / 2) * Math.sin(rad) + (fontMm * 0.35) * Math.cos(rad);
    doc.text(STAGING_POSTER_WATERMARK_TEXT, startX, startY, {
      angle: angleDeg,
    });
  } finally {
    doc.restoreGraphicsState();
  }
}
