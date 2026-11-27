/**
 * Motor común de carteles PDF con fondo corporativo + overlays:
 * tapas de placeholder (opcional) → logo → nombre → [marca de agua] → QR.
 * Lo usan cartel de acceso A5 (solo QR), flyer A6, cartel publicitario y pliego.
 *
 * Cartel de acceso A5 (`cartel-acceso-qr-a5.png`): el original NO tiene huecos
 * de logo ni nombre de farmacia; solo se personaliza el QR.
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

import { isMaterialSafePharmacyPublicUrl } from '@/lib/pharmacies/print-entrypoint-url';
import {
  fitPharmacyNameInZone,
  ptToMm,
} from '@/lib/pharmacies/pharmacy-qr-poster-fit';
import {
  containRect,
  resolvePosterNameColor,
} from '@/lib/pharmacies/pharmacy-qr-poster-compose';
import {
  insetRectMm,
  isPharmacyQrPosterDownloadEnabled,
  isPharmacyQrPosterTemplateReady,
  PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE,
  PHARMACY_QR_POSTER_LAYOUT,
  PHARMACY_QR_POSTER_LOGO_LOAD_ERROR,
  PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE,
  qrInnerRectMm,
  rectNormToMm,
  type PharmacyQrPosterLayout,
  type PosterRectMm,
  type PosterRectNorm,
} from '@/lib/pharmacies/pharmacy-qr-poster-layout';
import {
  ensurePosterNameFont,
  POSTER_NAME_FONT_FAMILY,
} from '@/lib/pharmacies/pharmacy-qr-poster-font';
import { drawStagingWatermark } from '@/lib/pharmacies/pharmacy-poster-pdf-helpers';
import { posterPdfTitle } from '@/lib/pharmacies/pharmacy-poster-meta';

export {
  isPharmacyQrPosterDownloadEnabled,
  isPharmacyQrPosterTemplateReady,
  pharmacyAccessCartelLayout,
  pharmacyAdPosterLayout,
  pharmacyFlyerLayout,
  pharmacyQrPosterLayoutForFormat,
  posterPageFormatLabel,
  PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE,
  PHARMACY_QR_POSTER_LAYOUT,
  PHARMACY_QR_POSTER_LOGO_LOAD_ERROR,
  PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE,
  POSTER_PAGE_MM,
  type PosterPageFormat,
} from '@/lib/pharmacies/pharmacy-qr-poster-layout';

export type PharmacyQrPosterBuildResult = {
  blob: Blob;
  nameWarning: string | null;
  usedLogo: boolean;
  nameColor: string;
  nameColorFallback: boolean;
};

export async function loadImageAsDataUrl(src: string): Promise<string> {
  const absolute =
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:')
      ? src
      : typeof window !== 'undefined'
        ? `${window.location.origin}${src.startsWith('/') ? src : `/${src}`}`
        : src;

  const res = await fetch(absolute);
  if (!res.ok) {
    throw new Error('No se ha podido cargar la imagen del cartel');
  }
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Imagen del cartel ilegible'));
    reader.readAsDataURL(blob);
  });
}

export function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('No se ha podido decodificar la imagen'));
    img.src = dataUrl;
  });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace('#', '').trim();
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) {
    return { r: 11, g: 11, b: 11 };
  }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Recorta márgenes transparentes excesivos (alpha≈0).
 * Si no hay alpha o el recorte es mínimo, devuelve el original.
 */
export async function trimTransparentMargins(
  logoDataUrl: string
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadHtmlImage(logoDataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: logoDataUrl, width: w, height: h };
  }
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, w, h);

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3]!;
      if (a > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { dataUrl: logoDataUrl, width: w, height: h };
  }

  const trimmedW = maxX - minX + 1;
  const trimmedH = maxY - minY + 1;
  const trimmedArea = trimmedW * trimmedH;
  const fullArea = w * h;
  if (trimmedArea / fullArea > 0.88) {
    return { dataUrl: logoDataUrl, width: w, height: h };
  }

  const out = document.createElement('canvas');
  out.width = trimmedW;
  out.height = trimmedH;
  const octx = out.getContext('2d');
  if (!octx) {
    return { dataUrl: logoDataUrl, width: w, height: h };
  }
  octx.drawImage(
    canvas,
    minX,
    minY,
    trimmedW,
    trimmedH,
    0,
    0,
    trimmedW,
    trimmedH
  );
  return {
    dataUrl: out.toDataURL('image/png'),
    width: trimmedW,
    height: trimmedH,
  };
}

export type PosterOrigin = { xMm: number; yMm: number };

function shiftRect(r: PosterRectMm, o?: PosterOrigin): PosterRectMm {
  if (!o) return r;
  return { ...r, x: r.x + o.xMm, y: r.y + o.yMm };
}

function intersectNormRect(
  a: PosterRectNorm,
  b: PosterRectNorm | undefined
): PosterRectNorm {
  if (!b) return a;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return { x, y, w: Math.max(x2 - x, 0), h: Math.max(y2 - y, 0) };
}

function drawName(
  doc: jsPDF,
  pharmacyName: string,
  nameSlot: PosterRectMm,
  layout: PharmacyQrPosterLayout,
  colorHex: string,
  fontFamily: string = POSTER_NAME_FONT_FAMILY
): string | null {
  const fit = fitPharmacyNameInZone(doc, pharmacyName, nameSlot, {
    maxFontSizePt: layout.name.maxFontSizePt,
    minFontSizePt: layout.name.minFontSizePt,
    maxLines: layout.name.maxLines,
    fontStyle: layout.name.fontStyle,
    fontFamily,
    uppercase: true,
  });
  const rgb = hexToRgb(colorHex);
  doc.setFont(fontFamily, layout.name.fontStyle);
  doc.setFontSize(fit.fontSizePt);
  doc.setTextColor(rgb.r, rgb.g, rgb.b);

  const lineH = ptToMm(fit.fontSizePt) * 1.15;
  const blockH = fit.lines.length * lineH;
  // Centrado vertical en la misma franja que el logo (zona superior).
  const startY =
    nameSlot.y + Math.max((nameSlot.h - blockH) / 2, 0) + lineH * 0.78;
  const x =
    layout.name.align === 'center'
      ? nameSlot.x + nameSlot.w / 2
      : layout.name.align === 'right'
        ? nameSlot.x + nameSlot.w
        : nameSlot.x;

  doc.text(fit.lines, x, startY, {
    align: layout.name.align,
    maxWidth: nameSlot.w,
  });
  return fit.warning;
}

/** Resolución objetivo de los fondos en el PDF (suficiente para impresión). */
const POSTER_BACKGROUND_DPI = 300;

/**
 * Reduce el fondo a ~300 dpi para el tamaño de página y lo recomprime en JPEG
 * (los artes originales miden 1000+ dpi y darían PDFs de 80–160 MB).
 * Solo en navegador; sin DOM (tests/node) devuelve el original.
 */
export async function downscaleBackgroundForPdf(
  dataUrl: string,
  pageWidthMm: number,
  dpi: number = POSTER_BACKGROUND_DPI
): Promise<string> {
  if (typeof document === 'undefined') return dataUrl;
  try {
    const img = await loadHtmlImage(dataUrl);
    const targetW = Math.round((pageWidthMm / 25.4) * dpi);
    if (!img.naturalWidth || img.naturalWidth <= targetW) return dataUrl;
    const scale = targetW / img.naturalWidth;
    const w = targetW;
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    // Fondo blanco: los PNG con alpha no deben quedar negros en JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return dataUrl;
  }
}

/** Carga el fondo corporativo del layout, ya optimizado para el PDF. */
export async function loadPosterBackground(
  layout: PharmacyQrPosterLayout
): Promise<string> {
  const raw = await loadImageAsDataUrl(layout.backgroundSrc!);
  return downscaleBackgroundForPdf(raw, layout.page.widthMm);
}

/** PNG del QR para materiales (misma calidad que el cartel de acceso). */
export function buildPosterQrDataUrl(
  publicUrl: string,
  widthPx = 1400,
  darkColor = '#0B0B0B'
): Promise<string> {
  return QRCode.toDataURL(publicUrl, {
    width: widthPx,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: darkColor, light: '#ffffff' },
  });
}

export type PosterLogoAsset = {
  dataUrl: string;
  width: number;
  height: number;
};

/**
 * Carga el logo de la farmacia (si hay URL) y lo deja recortado y medido.
 * Lanza PHARMACY_QR_POSTER_LOGO_LOAD_ERROR si hay URL pero no se puede leer.
 */
export async function loadPosterLogoAsset(
  logoUrl: string | null | undefined
): Promise<PosterLogoAsset | null> {
  if (!logoUrl?.trim()) return null;
  try {
    const dataUrl = await loadImageAsDataUrl(logoUrl);
    if (typeof document !== 'undefined') {
      const trimmed = await trimTransparentMargins(dataUrl);
      return {
        dataUrl: trimmed.dataUrl,
        width: trimmed.width,
        height: trimmed.height,
      };
    }
    const img = await loadHtmlImage(dataUrl);
    return { dataUrl, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    throw new Error(PHARMACY_QR_POSTER_LOGO_LOAD_ERROR);
  }
}

/** Dibuja el QR en su zona (con origen opcional para pliegos). */
export function drawPosterQr(
  doc: jsPDF,
  qrDataUrl: string,
  layout: PharmacyQrPosterLayout,
  origin?: PosterOrigin
): void {
  const zone = shiftRect(rectNormToMm(layout.qr.rect, layout.page), origin);
  const inner = qrInnerRectMm(zone, layout.qr.quietZoneRatio);
  // El PNG del QR ya lleva quiet zone blanca (margin) → legible sobre el arte.
  doc.addImage(
    qrDataUrl,
    'PNG',
    inner.x,
    inner.y,
    inner.w,
    inner.h,
    undefined,
    'NONE'
  );
}

/** Guías de depuración (rojo/verde). Nunca en el PDF de producción. */
export function drawPosterZoneGuides(
  doc: jsPDF,
  layout: PharmacyQrPosterLayout = PHARMACY_QR_POSTER_LAYOUT
): void {
  const logo = rectNormToMm(layout.logo.rect, layout.page);
  const name = rectNormToMm(layout.name.rect, layout.page);
  doc.setDrawColor(220, 20, 20);
  doc.setLineWidth(0.35);
  doc.rect(logo.x, logo.y, logo.w, logo.h);
  doc.setDrawColor(20, 160, 40);
  doc.rect(name.x, name.y, name.w, name.h);
}

export async function drawPharmacyQrPosterFromTemplate(
  doc: jsPDF,
  input: {
    pharmacyName: string;
    backgroundDataUrl: string;
    qrDataUrl: string;
    logoDataUrl?: string | null;
    primaryColor?: string | null;
    layout?: PharmacyQrPosterLayout;
    logoWidth?: number;
    logoHeight?: number;
    /** Solo revisión visual: dibuja zonas roja/verde. */
    showZoneGuides?: boolean;
    /** Entorno staging: marca de agua «PRUEBA - STAGING» (debajo del QR). */
    stagingWatermark?: boolean;
    /** Esquina superior izquierda de la página (mm). Default 0,0. Para pliegos. */
    origin?: PosterOrigin;
    /** No dibuja el QR (el pliego lo dibuja tras la marca de agua única). */
    skipQr?: boolean;
    /** El logo ya viene recortado (evita repetir el trim en cada flyer). */
    logoPreTrimmed?: boolean;
  }
): Promise<{
  nameWarning: string | null;
  usedLogo: boolean;
  nameColor: string;
  nameColorFallback: boolean;
}> {
  const layout = input.layout ?? PHARMACY_QR_POSTER_LAYOUT;
  const { widthMm, heightMm } = layout.page;
  const origin = input.origin;

  doc.addImage(
    input.backgroundDataUrl,
    input.backgroundDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG',
    origin?.xMm ?? 0,
    origin?.yMm ?? 0,
    widthMm,
    heightMm,
    undefined,
    'NONE'
  );

  const hasLogoInput = Boolean(input.logoDataUrl?.trim());
  // Tapas opacas de placeholders del arte original (antes de logo/nombre/QR).
  for (const cover of layout.placeholderCovers ?? []) {
    const box = shiftRect(rectNormToMm(cover.rect, layout.page), origin);
    // Sin logo: la caja del logo se funde con el fondo en vez de quedar gris vacía.
    const rgb = hexToRgb(
      cover.target === 'logo' && !hasLogoInput && cover.emptyColor
        ? cover.emptyColor
        : cover.color
    );
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(box.x, box.y, box.w, box.h, 'F');
  }

  let usedLogo = false;
  if (layout.logo.configured) {
    let logoDataUrl = input.logoDataUrl?.trim() || null;
    let logoW = input.logoWidth ?? 0;
    let logoH = input.logoHeight ?? 0;

    if (logoDataUrl && !input.logoPreTrimmed && typeof document !== 'undefined') {
      const trimmed = await trimTransparentMargins(logoDataUrl);
      logoDataUrl = trimmed.dataUrl;
      logoW = trimmed.width;
      logoH = trimmed.height;
    }

    if (logoDataUrl && logoW > 0 && logoH > 0) {
      const logoBox = insetRectMm(
        shiftRect(rectNormToMm(layout.logo.rect, layout.page), origin),
        layout.logo.insetRatio
      );
      const fitted = containRect(logoW, logoH, logoBox);
      if (fitted.w > 0 && fitted.h > 0) {
        const format = logoDataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(
          logoDataUrl,
          format,
          fitted.x,
          fitted.y,
          fitted.w,
          fitted.h,
          undefined,
          'NONE'
        );
        usedLogo = true;
      }
    }
  }

  const colorRes = resolvePosterNameColor(
    input.primaryColor,
    layout.name.fallbackColor
  );
  let nameWarning: string | null = null;
  if (layout.name.configured) {
    const nameNorm = intersectNormRect(
      layout.name.rect,
      layout.name.visibleRect
    );
    const nameBox = insetRectMm(
      shiftRect(rectNormToMm(nameNorm, layout.page), origin),
      layout.name.insetRatio
    );
    let fontFamily = POSTER_NAME_FONT_FAMILY;
    try {
      fontFamily = await ensurePosterNameFont(doc);
    } catch {
      fontFamily = 'helvetica';
    }
    nameWarning = drawName(
      doc,
      input.pharmacyName,
      nameBox,
      layout,
      colorRes.color,
      fontFamily
    );
  }
  // Marca de agua staging ANTES del QR para no degradar su lectura.
  if (input.stagingWatermark) {
    drawStagingWatermark(doc, layout.page, origin);
  }
  if (!input.skipQr) {
    drawPosterQr(doc, input.qrDataUrl, layout, origin);
  }

  if (input.showZoneGuides) {
    drawPosterZoneGuides(doc, layout);
  }

  return {
    nameWarning,
    usedLogo,
    nameColor: colorRes.color,
    nameColorFallback: colorRes.usedFallback,
  };
}

export async function buildPharmacyQrPosterPdf(input: {
  pharmacyName: string;
  publicUrl: string;
  publicId: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  layout?: PharmacyQrPosterLayout;
  backgroundDataUrl?: string;
  logoDataUrl?: string | null;
  logoWidth?: number;
  logoHeight?: number;
  allowUnapprovedReview?: boolean;
  showZoneGuides?: boolean;
  /** Staging: marca de agua + metadatos «PRUEBA-STAGING» (permite QR de staging). */
  staging?: boolean;
  /** Tipo de material para metadatos del PDF (default: acceso). */
  kind?: 'acceso' | 'flyer';
}): Promise<PharmacyQrPosterBuildResult> {
  if (
    !isMaterialSafePharmacyPublicUrl(input.publicUrl, {
      allowStaging: input.staging === true,
    })
  ) {
    throw new Error(
      'La URL del QR no es la de producción. No se genera el cartel.'
    );
  }

  const layout = input.layout ?? PHARMACY_QR_POSTER_LAYOUT;
  if (!isPharmacyQrPosterTemplateReady(layout)) {
    throw new Error(PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE);
  }
  if (
    !input.allowUnapprovedReview &&
    !isPharmacyQrPosterDownloadEnabled(layout)
  ) {
    throw new Error(PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE);
  }

  const backgroundSrc = layout.backgroundSrc!;
  // Layout sin hueco de logo (cartel acceso A5): se ignora el logo.
  const wantsLogo =
    layout.logo.configured &&
    Boolean((input.logoDataUrl ?? input.logoUrl ?? '').toString().trim());

  let logoDataUrl: string | null = input.logoDataUrl ?? null;
  let logoWidth = input.logoWidth;
  let logoHeight = input.logoHeight;

  const [backgroundDataUrl, qrDataUrl] = await Promise.all([
    input.backgroundDataUrl
      ? Promise.resolve(input.backgroundDataUrl)
      : loadPosterBackground(layout),
    QRCode.toDataURL(input.publicUrl, {
      width: 1400,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0B0B0B', light: '#ffffff' },
    }),
  ]);

  if (wantsLogo && !logoDataUrl) {
    try {
      logoDataUrl = await loadImageAsDataUrl(input.logoUrl!);
    } catch {
      throw new Error(PHARMACY_QR_POSTER_LOGO_LOAD_ERROR);
    }
  }

  if (logoDataUrl && (!logoWidth || !logoHeight) && typeof Image !== 'undefined') {
    try {
      const img = await loadHtmlImage(logoDataUrl);
      logoWidth = img.naturalWidth;
      logoHeight = img.naturalHeight;
    } catch {
      throw new Error(PHARMACY_QR_POSTER_LOGO_LOAD_ERROR);
    }
  }

  if (wantsLogo && (!logoDataUrl || !logoWidth || !logoHeight)) {
    throw new Error(PHARMACY_QR_POSTER_LOGO_LOAD_ERROR);
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [layout.page.widthMm, layout.page.heightMm],
    compress: true,
  });

  doc.setProperties({
    title: posterPdfTitle({
      kind: input.kind ?? 'acceso',
      pharmacyName: input.pharmacyName,
      staging: input.staging,
    }),
  });

  const drawn = await drawPharmacyQrPosterFromTemplate(doc, {
    pharmacyName: input.pharmacyName,
    backgroundDataUrl,
    qrDataUrl,
    logoDataUrl,
    logoWidth,
    logoHeight,
    primaryColor: input.primaryColor,
    layout,
    showZoneGuides: input.showZoneGuides === true,
    stagingWatermark: input.staging === true,
  });

  return {
    blob: doc.output('blob'),
    nameWarning: drawn.nameWarning,
    usedLogo: drawn.usedLogo,
    nameColor: drawn.nameColor,
    nameColorFallback: drawn.nameColorFallback,
  };
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
