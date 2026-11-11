/**
 * Layout del cartel QR A4: plantilla Canva (PNG) + zonas dinámicas.
 *
 * Plantilla: public/images/posters/pharmacy-qr-a4.png (export Canva).
 * La app solo superpone logo, nombre y QR. Coordenadas en fracción 0..1
 * del tamaño de la plantilla → mm A4 (210×297).
 *
 * pdfDownloadEnabled permanece false hasta aprobación visual.
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

export type PharmacyQrPosterLogoZone = {
  configured: boolean;
  rect: PosterRectNorm;
};

export type PharmacyQrPosterNameZone = {
  configured: boolean;
  rect: PosterRectNorm;
  rectWithoutLogo: PosterRectNorm | null;
  maxFontSizePt: number;
  minFontSizePt: number;
  maxLines: 1 | 2;
  color: string;
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
  logo: PharmacyQrPosterLogoZone;
  name: PharmacyQrPosterNameZone;
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

export function containRect(
  srcW: number,
  srcH: number,
  box: PosterRectMm
): PosterRectMm {
  if (srcW <= 0 || srcH <= 0 || box.w <= 0 || box.h <= 0) {
    return { x: box.x, y: box.y, w: 0, h: 0 };
  }
  const scale = Math.min(box.w / srcW, box.h / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return {
    x: box.x + (box.w - w) / 2,
    y: box.y + (box.h - h) / 2,
    w,
    h,
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

/**
 * Medido sobre pharmacy-qr-a4.png (4419×6250; mismas fracciones relativas que 724×1024):
 * - Cabecera blanca entre líneas turquesa y≈134..848
 * - Caja QR blanca (interior, sin borde turquesa) ≈ 2716,4590 → 4206,6099
 */
const TEMPLATE_PX = { width: 4419, height: 6250 } as const;

function px(
  x: number,
  y: number,
  w: number,
  h: number
): PosterRectNorm {
  return rectPxToNorm({ x, y, w, h }, TEMPLATE_PX);
}

export const PHARMACY_QR_POSTER_LAYOUT: PharmacyQrPosterLayout = {
  backgroundSrc: '/images/posters/pharmacy-qr-a4.png',
  templatePx: { ...TEMPLATE_PX },
  page: { widthMm: 210, heightMm: 297 },
  logo: {
    configured: true,
    // Franja superior de cabecera (bajo 1ª línea turquesa)
    rect: px(549, 171, 3320, 317),
  },
  name: {
    configured: true,
    // Bajo el logo, aún sobre la 2ª línea turquesa (y≈140)
    rect: px(305, 513, 3809, 293),
    // Sin logo: usa casi toda la cabecera
    rectWithoutLogo: px(305, 195, 3809, 610),
    maxFontSizePt: 18,
    minFontSizePt: 9,
    maxLines: 2,
    color: '#0B0B0B',
    align: 'center',
    fontStyle: 'bold',
  },
  qr: {
    configured: true,
    // Interior de la caja blanca (pad ~10px respecto al borde turquesa)
    rect: px(2777, 4651, 1373, 1392),
    quietZoneRatio: 0.04,
  },
  // Pendiente de aprobación visual de los PDFs de ejemplo
  pdfDownloadEnabled: false,
};

export function isPharmacyQrPosterTemplateReady(
  layout: PharmacyQrPosterLayout = PHARMACY_QR_POSTER_LAYOUT
): boolean {
  if (!layout.backgroundSrc?.trim()) return false;
  if (!layout.logo.configured || !layout.name.configured || !layout.qr.configured) {
    return false;
  }
  const lr = layout.logo.rect;
  const nr = layout.name.rect;
  const qr = layout.qr.rect;
  if (lr.w <= 0 || lr.h <= 0) return false;
  if (nr.w <= 0 || nr.h <= 0) return false;
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
