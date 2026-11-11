/**
 * Layout del cartel QR A4: plantilla Canva (PNG) + zonas dinámicas.
 *
 * La composición visual (logo, titulares, ilustraciones, colores) vive en la
 * plantilla exportada desde Canva. La app solo superpone:
 *   1) nombre real de la farmacia
 *   2) QR de la URL canónica de producción
 *
 * Las coordenadas se rellenan cuando Pilar entregue el PNG y las posiciones.
 * Hasta entonces `configured: false` y no se inventa ninguna plantilla.
 */

export type PosterRectMm = {
  /** Origen X desde la esquina superior izquierda (mm). */
  x: number;
  /** Origen Y desde la esquina superior izquierda (mm). */
  y: number;
  w: number;
  h: number;
};

export type PharmacyQrPosterNameZone = {
  configured: boolean;
  rect: PosterRectMm;
  /** Tamaño de fuente en pt (jsPDF). */
  fontSizePt: number;
  /** Color CSS hex. */
  color: string;
  align: 'left' | 'center' | 'right';
  fontStyle: 'normal' | 'bold';
};

export type PharmacyQrPosterQrZone = {
  configured: boolean;
  /** Caja donde se dibuja el QR (incluye quiet zone del propio PNG). */
  rect: PosterRectMm;
};

export type PharmacyQrPosterLayout = {
  /**
   * Ruta pública del PNG A4 de Canva (bajo /public).
   * null = aún no entregado; no generar PDF.
   */
  backgroundSrc: string | null;
  page: { widthMm: number; heightMm: number };
  name: PharmacyQrPosterNameZone;
  qr: PharmacyQrPosterQrZone;
};

/**
 * Configuración vigente. Actualizar `backgroundSrc` y `configured` + `rect`
 * cuando llegue el export Canva y las medidas acordadas.
 */
export const PHARMACY_QR_POSTER_LAYOUT: PharmacyQrPosterLayout = {
  backgroundSrc: null,
  page: { widthMm: 210, heightMm: 297 },
  name: {
    configured: false,
    // Placeholders — NO usar hasta configured: true
    rect: { x: 0, y: 0, w: 0, h: 0 },
    fontSizePt: 18,
    color: '#0B0B0B',
    align: 'center',
    fontStyle: 'bold',
  },
  qr: {
    configured: false,
    rect: { x: 0, y: 0, w: 0, h: 0 },
  },
};

export function isPharmacyQrPosterTemplateReady(
  layout: PharmacyQrPosterLayout = PHARMACY_QR_POSTER_LAYOUT
): boolean {
  if (!layout.backgroundSrc?.trim()) return false;
  if (!layout.name.configured) return false;
  if (!layout.qr.configured) return false;
  const nr = layout.name.rect;
  const qr = layout.qr.rect;
  if (nr.w <= 0 || nr.h <= 0) return false;
  if (qr.w <= 0 || qr.h <= 0) return false;
  return true;
}

export const PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE =
  'La plantilla Canva del cartel aún no está configurada. Cuando esté lista se podrá descargar el PDF.';
