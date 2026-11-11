/**
 * Layout del cartel QR A4: plantilla Canva (PNG) + zonas dinámicas.
 *
 * La composición visual fija vive en Canva. La app solo superpone:
 *   1) logo de la farmacia (pharmacy_branding.logo_url)
 *   2) nombre real de la farmacia
 *   3) QR de la URL canónica de producción
 *
 * Coordenadas en fracción 0..1 del tamaño de la plantilla (relativas),
 * convertidas a mm A4 (210×297) al generar el PDF.
 *
 * Hasta recibir el PNG Canva: backgroundSrc=null, zonas configured=false.
 * Hasta aprobación visual: pdfDownloadEnabled=false.
 */

export type PosterRectNorm = {
  /** Origen X relativo (0 = izquierda, 1 = derecha). */
  x: number;
  /** Origen Y relativo (0 = arriba, 1 = abajo). */
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
  /** Zona reservada para el logo (contain, centrado). */
  rect: PosterRectNorm;
};

export type PharmacyQrPosterNameZone = {
  configured: boolean;
  /** Zona del nombre cuando hay logo. */
  rect: PosterRectNorm;
  /**
   * Zona ampliada del nombre si no hay logo (ocupa logo+nombre).
   * Si null, se usa `rect` tal cual.
   */
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
  /**
   * Margen blanco interior relativo al lado menor de la zona (0..0.25).
   * El QR se dibuja en el rect interior.
   */
  quietZoneRatio: number;
};

export type PharmacyQrPosterLayout = {
  /**
   * Ruta pública del PNG A4 de Canva (bajo /public).
   * null = aún no entregado.
   */
  backgroundSrc: string | null;
  /**
   * Tamaño del export Canva en píxeles (para documentar origen de las
   * fracciones). No afecta al PDF si las zonas ya están en 0..1.
   */
  templatePx: { width: number; height: number } | null;
  page: { widthMm: number; heightMm: number };
  logo: PharmacyQrPosterLogoZone;
  name: PharmacyQrPosterNameZone;
  qr: PharmacyQrPosterQrZone;
  /**
   * false hasta aprobación visual de los PDFs de ejemplo.
   * Aunque la plantilla esté lista, la UI no descarga el PDF definitivo.
   */
  pdfDownloadEnabled: boolean;
};

/** Convierte rect relativo (0..1) a mm sobre la página A4. */
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

/** Rect en píxeles de plantilla → fracción 0..1. */
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

/**
 * Escala contain: encaja src dentro de box sin crop ni stretch, centrado.
 */
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

/** QR interior tras quiet zone. */
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
 * Configuración vigente.
 * Coordenadas definitivas: se fijan al medir el PNG Canva (sin inventar zonas).
 */
export const PHARMACY_QR_POSTER_LAYOUT: PharmacyQrPosterLayout = {
  backgroundSrc: null,
  templatePx: null,
  page: { widthMm: 210, heightMm: 297 },
  logo: {
    configured: false,
    rect: { x: 0, y: 0, w: 0, h: 0 },
  },
  name: {
    configured: false,
    rect: { x: 0, y: 0, w: 0, h: 0 },
    rectWithoutLogo: null,
    maxFontSizePt: 22,
    minFontSizePt: 10,
    maxLines: 2,
    color: '#0B0B0B',
    align: 'center',
    fontStyle: 'bold',
  },
  qr: {
    configured: false,
    rect: { x: 0, y: 0, w: 0, h: 0 },
    quietZoneRatio: 0.06,
  },
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

/** Listo para que el panel descargue el PDF (plantilla + OK visual). */
export function isPharmacyQrPosterDownloadEnabled(
  layout: PharmacyQrPosterLayout = PHARMACY_QR_POSTER_LAYOUT
): boolean {
  return layout.pdfDownloadEnabled && isPharmacyQrPosterTemplateReady(layout);
}

export const PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE =
  'La plantilla Canva del cartel aún no está configurada. Cuando esté lista se podrá descargar el PDF.';

export const PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE =
  'El cartel PDF está pendiente de aprobación visual. Mientras tanto puedes descargar el QR en PNG o SVG.';
