/**
 * Layouts de material FarmaFácil: fondos corporativos + zonas dinámicas.
 *
 *  - Cartel acceso mostrador A5 (`cartel-acceso-qr-a5.png`): SOLO zona QR.
 *  - Flyer A6 (`flyer-acceso-qr-a6.png`): logo + nombre + QR (arte HD 4419×6250).
 *  - Cartel publicitario (`cartel-publicitario-a3.png`): logo + nombre + QR,
 *    con tapas opacas sobre los placeholders grises del original.
 *
 * Zonas ROJA (logo) y VERDE (nombre) del flyer son rectángulos INDEPENDIENTES
 * medidos sobre la referencia marcada (escala 724×1024 → 4419×6250).
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
  /**
   * Opcional: limita el texto a la parte visible del hueco (p. ej. caja gris
   * del cartel publicitario, más corta que la zona medida).
   */
  visibleRect?: PosterRectNorm;
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

/** Rectángulo opaco que tapa un placeholder del arte original. */
export type PharmacyPosterPlaceholderCover = {
  rect: PosterRectNorm;
  /** Color de relleno (muestreado del placeholder). */
  color: string;
  /** Qué hueco tapa (para decidir el relleno si falta el contenido). */
  target?: 'logo' | 'name';
  /** Relleno alternativo si no hay contenido para ese hueco (p. ej. sin logo). */
  emptyColor?: string;
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
  /** Se pintan ANTES de logo/nombre/QR (tapan «[LOGO FARMACIA]», etc.). */
  placeholderCovers?: PharmacyPosterPlaceholderCover[];
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
/**
 * Formatos de impresión soportados (misma proporción ISO ≈ √2).
 * Todas las zonas están normalizadas (0..1): A3/A5 escalan la plantilla A4
 * sin rediseñar la composición. A5 (148×210) difiere de A4/√2 en ≈0,3 %.
 */
export type PosterPageFormat = 'a4' | 'a3' | 'a5' | 'a6';

export const POSTER_PAGE_MM: Record<
  PosterPageFormat,
  { widthMm: number; heightMm: number }
> = {
  a4: { widthMm: 210, heightMm: 297 },
  a3: { widthMm: 297, heightMm: 420 },
  a5: { widthMm: 148, heightMm: 210 },
  a6: { widthMm: 105, heightMm: 148 },
};

/** Factor lineal respecto a A4 (tipografía/márgenes). A3 = √2 exacto. */
export function posterFormatScale(format: PosterPageFormat): number {
  if (format === 'a3') return Math.SQRT2;
  if (format === 'a5') return POSTER_PAGE_MM.a5.widthMm / POSTER_PAGE_MM.a4.widthMm;
  if (format === 'a6') return POSTER_PAGE_MM.a6.widthMm / POSTER_PAGE_MM.a4.widthMm;
  return 1;
}

/** Arte del flyer A6 (mismo arte que el antiguo pharmacy-qr-a4.png). */
export const FLYER_ACCESS_BACKGROUND_SRC =
  '/images/posters/flyer-acceso-qr-a6-print.jpg'
export const ACCESS_CARTEL_BACKGROUND_SRC =
  '/images/posters/cartel-acceso-qr-a5-print.jpg'
export const AD_CARTEL_BACKGROUND_SRC =
  '/images/posters/cartel-publicitario-a3-print.jpg'

/** Layout base del flyer (zonas HD) en A4; los demás formatos escalan. */
export const PHARMACY_QR_POSTER_LAYOUT: PharmacyQrPosterLayout = {
  backgroundSrc: FLYER_ACCESS_BACKGROUND_SRC,
  templatePx: { ...TEMPLATE_PX },
  page: { ...POSTER_PAGE_MM.a4 },
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
  pdfDownloadEnabled: true,
};

/**
 * Misma plantilla del flyer (zonas normalizadas) en cualquier formato.
 * A3 escala tipografía ≈ √2; A5 ≈ 0,705; A6 = 0,5.
 */
export function pharmacyQrPosterLayoutForFormat(
  format: PosterPageFormat = 'a4'
): PharmacyQrPosterLayout {
  if (format === 'a4') return PHARMACY_QR_POSTER_LAYOUT;
  const scale = posterFormatScale(format);
  const base = PHARMACY_QR_POSTER_LAYOUT;
  const minFloor = format === 'a6' ? 7 : 0;
  return {
    ...base,
    page: { ...POSTER_PAGE_MM[format] },
    name: {
      ...base.name,
      maxFontSizePt: Math.round(base.name.maxFontSizePt * scale),
      minFontSizePt: Math.max(
        Math.round(base.name.minFontSizePt * scale),
        minFloor
      ),
    },
  };
}

/** Plantilla 2 · Flyer A6 (105×148 mm): logo + nombre + QR. */
export function pharmacyFlyerLayout(): PharmacyQrPosterLayout {
  return pharmacyQrPosterLayoutForFormat('a6');
}

/**
 * Plantilla 1 · Cartel de acceso mostrador A5 (148×210 mm).
 * El original `Cartel_01` NO tiene huecos de logo ni nombre de farmacia:
 * solo se personaliza el QR (zona medida sobre 1747×2481 px).
 */
export function pharmacyAccessCartelLayout(): PharmacyQrPosterLayout {
  return {
    backgroundSrc: ACCESS_CARTEL_BACKGROUND_SRC,
    templatePx: { width: 1747, height: 2481 },
    page: { ...POSTER_PAGE_MM.a5 },
    // Sin hueco de logo ni de nombre en el arte original.
    logo: {
      configured: false,
      rect: { x: 0, y: 0, w: 0, h: 0 },
      insetRatio: 0,
    },
    name: {
      configured: false,
      rect: { x: 0, y: 0, w: 0, h: 0 },
      insetRatio: 0,
      maxFontSizePt: 0,
      minFontSizePt: 0,
      maxLines: 1,
      fallbackColor: '#0B0B0B',
      align: 'center',
      fontStyle: 'bold',
    },
    qr: {
      configured: true,
      rect: { x: 0.3543, y: 0.4095, w: 0.2942, h: 0.2023 },
      quietZoneRatio: 0.04,
    },
    pdfDownloadEnabled: true,
  };
}

const AD_PLACEHOLDER_GRAY = '#DDDDDD';
/** Blanco roto del fondo del cartel junto a los placeholders. */
const AD_BACKGROUND_PAPER = '#F9F9F9';
/** Margen (normalizado) para tapar el antialias del borde del placeholder. */
const AD_COVER_PAD = 0.0006;

/**
 * Plantilla 3 · Cartel publicitario (arte nativo A3 3508×4961; A4 = mismas
 * zonas normalizadas). Los placeholders grises `[LOGO FARMACIA]` y
 * `[NOMBRE VISIBLE FARMACIA]` se tapan con relleno opaco antes de dibujar.
 */
export function pharmacyAdPosterLayout(
  format: 'a4' | 'a3' = 'a4'
): PharmacyQrPosterLayout {
  const scale = format === 'a3' ? 1 : POSTER_PAGE_MM.a4.widthMm / POSTER_PAGE_MM.a3.widthMm;
  // Tipografía definida para A3; A4 = A3 / √2.
  const a3Max = 42;
  const a3Min = 16;
  // Cajas grises medidas sobre el arte (normalizado).
  const logoGray = { x: 0.0473, y: 0.021, w: 0.2187, h: 0.0875 };
  const nameGray = { x: 0.3198, y: 0.0201, w: 0.6202, h: 0.0884 };
  const pad = (r: PosterRectNorm): PosterRectNorm => ({
    x: r.x - AD_COVER_PAD,
    y: r.y - AD_COVER_PAD,
    w: r.w + AD_COVER_PAD * 2,
    h: r.h + AD_COVER_PAD * 2,
  });
  return {
    backgroundSrc: AD_CARTEL_BACKGROUND_SRC,
    templatePx: { width: 3508, height: 4961 },
    page: { ...POSTER_PAGE_MM[format] },
    logo: {
      configured: true,
      rect: { x: 0.0468, y: 0.0208, w: 0.2195, h: 0.0861 },
      insetRatio: 0.06,
    },
    name: {
      configured: true,
      rect: { x: 0.3196, y: 0.0202, w: 0.6804, h: 0.0998 },
      visibleRect: nameGray,
      insetRatio: 0.05,
      maxFontSizePt: Math.round(a3Max * scale),
      minFontSizePt: Math.round(a3Min * scale),
      maxLines: 2,
      fallbackColor: '#0B0B0B',
      align: 'left',
      fontStyle: 'bold',
    },
    qr: {
      configured: true,
      rect: { x: 0.039, y: 0.76, w: 0.217, h: 0.153 },
      quietZoneRatio: 0.06,
    },
    placeholderCovers: [
      {
        rect: pad(logoGray),
        color: AD_PLACEHOLDER_GRAY,
        target: 'logo',
        emptyColor: AD_BACKGROUND_PAPER,
      },
      { rect: pad(nameGray), color: AD_PLACEHOLDER_GRAY, target: 'name' },
    ],
    pdfDownloadEnabled: true,
  };
}

export function posterPageFormatLabel(format: PosterPageFormat): string {
  if (format === 'a3') return 'A3';
  if (format === 'a5') return 'A5';
  if (format === 'a6') return 'A6';
  return 'A4';
}

export function isPharmacyQrPosterTemplateReady(
  layout: PharmacyQrPosterLayout = PHARMACY_QR_POSTER_LAYOUT
): boolean {
  if (!layout.backgroundSrc?.trim()) return false;
  // El QR es obligatorio; logo y nombre solo si el layout los declara.
  if (!layout.qr.configured) return false;
  if (layout.qr.rect.w <= 0 || layout.qr.rect.h <= 0) return false;
  if (
    layout.logo.configured &&
    (layout.logo.rect.w <= 0 || layout.logo.rect.h <= 0)
  ) {
    return false;
  }
  if (
    layout.name.configured &&
    (layout.name.rect.w <= 0 || layout.name.rect.h <= 0)
  ) {
    return false;
  }
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
