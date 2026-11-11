/**
 * Layout del cartel QR A4: plantilla Canva HD + zonas dinámicas.
 *
 * Zonas ROJA (logo) y VERDE (nombre) son rectángulos INDEPENDIENTES
 * medidos sobre la referencia marcada (escala 724×1024 → 4419×6250).
 * pdfDownloadEnabled=false hasta OK visual.
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
  /** Margen interior relativo al menor lado (0..0.2). */
  insetRatio: number;
};

export type PharmacyQrPosterNameStyle = {
  configured: boolean;
  rect: PosterRectNorm;
  insetRatio: number;
  maxFontSizePt: number;
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
  /** Zona ROJA: solo logo (izquierda, entre líneas turquesa). */
  logo: PharmacyQrPosterLogoZone;
  /** Zona VERDE: solo nombre (derecha). No se mueve si falta logo. */
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

/** Aplica margen interior a un rectángulo mm. */
export function insetRectMm(
  box: PosterRectMm,
  insetRatio: number
): PosterRectMm {
  const q = Math.min(Math.max(insetRatio, 0), 0.2);
  const pad = Math.min(box.w, box.h) * q;
  return {
    x: box.x + pad,
    y: box.y + pad,
    w: Math.max(box.w - pad * 2, 0),
    h: Math.max(box.h - pad * 2, 0),
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
 * Coordenadas HD derivadas de la anotación 724×1024 (escala ≈6.1036):
 *   ROJO  ann (45,29)–(143,128)  → HD (275,177,604×610)
 *   VERDE ann (161,29)–(681,130) → HD (983,177,3180×623)
 * Entre líneas turquesa HD ≈ y 122 y 861. QR sin cambios.
 */
export const PHARMACY_QR_POSTER_LAYOUT: PharmacyQrPosterLayout = {
  backgroundSrc: '/images/posters/pharmacy-qr-a4.png',
  templatePx: { ...TEMPLATE_PX },
  page: { widthMm: 210, heightMm: 297 },
  logo: {
    configured: true,
    rect: px(275, 177, 604, 610),
    insetRatio: 0.06,
  },
  name: {
    configured: true,
    rect: px(983, 177, 3180, 623),
    insetRatio: 0.05,
    /** Tipografía visual grande en la zona verde (MAYÚSCULAS en draw). */
    maxFontSizePt: 40,
    minFontSizePt: 14,
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
  if (!layout.logo.configured || !layout.name.configured || !layout.qr.configured) {
    return false;
  }
  if (layout.logo.rect.w <= 0 || layout.logo.rect.h <= 0) return false;
  if (layout.name.rect.w <= 0 || layout.name.rect.h <= 0) return false;
  if (layout.qr.rect.w <= 0 || layout.qr.rect.h <= 0) return false;
  return true;
}

export function isPharmacyQrPosterDownloadEnabled(
  layout: PharmacyQrPosterLayout = PHARMACY_QR_POSTER_LAYOUT
): boolean {
  // Override solo local/prueba: NEXT_PUBLIC_FF_POSTER_PDF_LOCAL=1
  // No activa descarga en producción salvo que el flag esté en el build.
  const localTest =
    typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_FF_POSTER_PDF_LOCAL === '1';
  return (
    (layout.pdfDownloadEnabled || localTest) &&
    isPharmacyQrPosterTemplateReady(layout)
  );
}

export const PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE =
  'La plantilla Canva del cartel aún no está configurada. Cuando esté lista se podrá descargar el PDF.';

export const PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE =
  'El cartel PDF está pendiente de aprobación visual. Mientras tanto puedes descargar el QR en PNG o SVG.';

export const PHARMACY_QR_POSTER_LOGO_LOAD_ERROR =
  'No se ha podido cargar el logo de la farmacia. Revisa el archivo en Personalización antes de generar el cartel.';
