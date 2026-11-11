/**
 * Layout del cartel QR A4: plantilla Canva HD + zonas dinámicas.
 *
 * Logo y nombre se componen dentro de `headerBand` (entre líneas turquesa).
 * QR en la caja blanca inferior. pdfDownloadEnabled=false hasta OK visual.
 */

export type PosterRectNorm = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PosterRectMm = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PharmacyQrPosterNameStyle = {
  configured: boolean;
  maxFontSizePt: number;
  maxFontSizeNoLogoPt: number;
  minFontSizePt: number;
  maxLines: 1 | 2;
  /** Fallback si el primario no contrasta. */
  fallbackColor: string;
  align: 'left' | 'center' | 'right';
  fontStyle: 'normal' | 'bold';
};

export type PharmacyQrPosterQrZone = {
  configured: boolean;
  rect: PosterRectNorm;
  quietZoneRatio: number;
};

export type PharmacyQrPosterLayout = {
  backgroundSrc: string | null;
  templatePx: { width: number; height: number } | null;
  page: { widthMm: number; heightMm: number };
  /**
   * Contenedor común logo+nombre entre las dos líneas turquesa.
   * Medido en HD 4419×6250 (y≈145..840).
   */
  headerBand: PosterRectNorm;
  headerPadXRatio: number;
  headerPadYMm: number;
  headerGapMm: number;
  name: PharmacyQrPosterNameStyle;
  qr: PharmacyQrPosterQrZone;
  pdfDownloadEnabled: boolean;
};

export function rectNormToMm(
  norm: PosterRectNorm,
  page: { widthMm: number; heightMm: number } = PHARMACY_QR_POSTER_LAYOUT.page
): PosterRectMm {
  return {
    x: norm.x * page.widthMm,
    y: norm.y * page.heightMm,
    w: norm.w * page.widthMm,
    h: norm.h * page.heightMm,
  };
}

export function rectPxToNorm(
  px: { x: number; y: number; w: number; h: number },
  templatePx: { width: number; height: number }
): PosterRectNorm {
  return {
    x: px.x / templatePx.width,
    y: px.y / templatePx.height,
    w: px.w / templatePx.width,
    h: px.h / templatePx.height,
  };
}

export function qrInnerRectMm(
  zone: PosterRectMm,
  quietZoneRatio: number
): PosterRectMm {
  const q = Math.min(Math.max(quietZoneRatio, 0), 0.25);
  const pad = Math.min(zone.w, zone.h) * q;
  const inner: PosterRectMm = {
    x: zone.x + pad,
    y: zone.y + pad,
    w: Math.max(zone.w - pad * 2, 0),
    h: Math.max(zone.h - pad * 2, 0),
  };
  const size = Math.min(inner.w, inner.h);
  return {
    x: inner.x + (inner.w - size) / 2,
    y: inner.y + (inner.h - size) / 2,
    w: size,
    h: size,
  };
}

const TEMPLATE_PX = { width: 4419, height: 6250 } as const;

function px(
  x: number,
  y: number,
  w: number,
  h: number
): PosterRectNorm {
  return rectPxToNorm({ x, y, w, h }, TEMPLATE_PX);
}

/**
 * Líneas turquesa HD ≈ y 115–135 y 855–874.
 * Band útil interior ≈ 145..840, márgenes laterales ~7%.
 * QR: interior caja blanca (misma fracción relativa validada).
 */
export const PHARMACY_QR_POSTER_LAYOUT: PharmacyQrPosterLayout = {
  backgroundSrc: '/images/posters/pharmacy-qr-a4.png',
  templatePx: { ...TEMPLATE_PX },
  page: { widthMm: 210, heightMm: 297 },
  headerBand: px(280, 145, 3859, 695),
  headerPadXRatio: 0.06,
  headerPadYMm: 1.0,
  headerGapMm: 2.0,
  name: {
    configured: true,
    maxFontSizePt: 16,
    maxFontSizeNoLogoPt: 20,
    minFontSizePt: 9,
    maxLines: 2,
    fallbackColor: '#0B0B0B',
    align: 'center',
    fontStyle: 'bold',
  },
  qr: {
    configured: true,
    rect: px(2777, 4651, 1373, 1392),
    quietZoneRatio: 0.04,
  },
  pdfDownloadEnabled: false,
};

export function isPharmacyQrPosterTemplateReady(
  layout: PharmacyQrPosterLayout = PHARMACY_QR_POSTER_LAYOUT
): boolean {
  if (!layout.backgroundSrc?.trim()) return false;
  if (!layout.name.configured || !layout.qr.configured) return false;
  const band = layout.headerBand;
  const qr = layout.qr.rect;
  if (band.w <= 0 || band.h <= 0) return false;
  if (qr.w <= 0 || qr.h <= 0) return false;
  return true;
}

export function isPharmacyQrPosterDownloadEnabled(
  layout: PharmacyQrPosterLayout = PHARMACY_QR_POSTER_LAYOUT
): boolean {
  return layout.pdfDownloadEnabled && isPharmacyQrPosterTemplateReady(layout);
}

export const PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE =
  'La plantilla Canva del cartel aún no está configurada. Cuando esté lista se podrá descargar el PDF.';

export const PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE =
  'El cartel PDF está pendiente de aprobación visual. Mientras tanto puedes descargar el QR en PNG o SVG.';

export const PHARMACY_QR_POSTER_LOGO_LOAD_ERROR =
  'No se ha podido cargar el logo de la farmacia. Revisa el archivo en Personalización antes de generar el cartel.';
