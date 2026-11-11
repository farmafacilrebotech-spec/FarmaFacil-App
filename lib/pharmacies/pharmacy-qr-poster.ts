/**
 * Cartel PDF A4: plantilla Canva HD + logo + nombre + QR.
 * Composición superior dinámica dentro de headerBand.
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

import { isPrintSafePharmacyPublicUrl } from '@/lib/pharmacies/print-entrypoint-url';
import {
  fitPharmacyNameInZone,
  ptToMm,
} from '@/lib/pharmacies/pharmacy-qr-poster-fit';
import {
  containRect,
  layoutHeaderSlots,
  resolvePosterNameColor,
} from '@/lib/pharmacies/pharmacy-qr-poster-compose';
import {
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
} from '@/lib/pharmacies/pharmacy-qr-poster-layout';

export {
  isPharmacyQrPosterDownloadEnabled,
  isPharmacyQrPosterTemplateReady,
  PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE,
  PHARMACY_QR_POSTER_LAYOUT,
  PHARMACY_QR_POSTER_LOGO_LOAD_ERROR,
  PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE,
} from '@/lib/pharmacies/pharmacy-qr-poster-layout';

export type PharmacyQrPosterBuildResult = {
  blob: Blob;
  nameWarning: string | null;
  usedLogo: boolean;
  nameColor: string;
  nameColorFallback: boolean;
};

async function loadImageAsDataUrl(src: string): Promise<string> {
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

function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
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
  // Solo recortar si el margen vacío es significativo (>12%)
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

function drawName(
  doc: jsPDF,
  pharmacyName: string,
  nameSlot: PosterRectMm,
  layout: PharmacyQrPosterLayout,
  maxFontPt: number,
  colorHex: string
): string | null {
  const fit = fitPharmacyNameInZone(doc, pharmacyName, nameSlot, {
    maxFontSizePt: maxFontPt,
    minFontSizePt: layout.name.minFontSizePt,
    maxLines: layout.name.maxLines,
    fontStyle: layout.name.fontStyle,
  });
  const rgb = hexToRgb(colorHex);
  doc.setFont('helvetica', layout.name.fontStyle);
  doc.setFontSize(fit.fontSizePt);
  doc.setTextColor(rgb.r, rgb.g, rgb.b);

  const lineH = ptToMm(fit.fontSizePt) * 1.2;
  const blockH = fit.lines.length * lineH;
  const startY =
    nameSlot.y + Math.max((nameSlot.h - blockH) / 2, 0) + lineH * 0.8;
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

function drawQrInZone(
  doc: jsPDF,
  qrDataUrl: string,
  layout: PharmacyQrPosterLayout
): void {
  const zone = rectNormToMm(layout.qr.rect, layout.page);
  const inner = qrInnerRectMm(zone, layout.qr.quietZoneRatio);
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

export async function drawPharmacyQrPosterFromTemplate(
  doc: jsPDF,
  input: {
    pharmacyName: string;
    backgroundDataUrl: string;
    qrDataUrl: string;
    logoDataUrl?: string | null;
    /** Si true y hay logoUrl fallido, no se debe llamar (el caller lanza). */
    primaryColor?: string | null;
    layout?: PharmacyQrPosterLayout;
    /** Dimensiones logo ya conocidas (scripts Node). */
    logoWidth?: number;
    logoHeight?: number;
  }
): Promise<{
  nameWarning: string | null;
  usedLogo: boolean;
  nameColor: string;
  nameColorFallback: boolean;
}> {
  const layout = input.layout ?? PHARMACY_QR_POSTER_LAYOUT;
  const { widthMm, heightMm } = layout.page;

  doc.addImage(
    input.backgroundDataUrl,
    'PNG',
    0,
    0,
    widthMm,
    heightMm,
    undefined,
    'NONE'
  );

  let logoDataUrl = input.logoDataUrl?.trim() || null;
  let logoW = input.logoWidth ?? 0;
  let logoH = input.logoHeight ?? 0;

  if (logoDataUrl && typeof document !== 'undefined') {
    const trimmed = await trimTransparentMargins(logoDataUrl);
    logoDataUrl = trimmed.dataUrl;
    logoW = trimmed.width;
    logoH = trimmed.height;
  }

  const hasLogo = Boolean(logoDataUrl && logoW > 0 && logoH > 0);
  const band = rectNormToMm(layout.headerBand, layout.page);
  const slots = layoutHeaderSlots(band, {
    hasLogo,
    logoAspect: hasLogo ? logoW / logoH : undefined,
    padXRatio: layout.headerPadXRatio,
    padYMm: layout.headerPadYMm,
    gapMm: layout.headerGapMm,
    nameMinFontPt: layout.name.minFontSizePt,
    nameMaxFontPt: layout.name.maxFontSizePt,
    nameMaxFontNoLogoPt: layout.name.maxFontSizeNoLogoPt,
    nameMaxLines: layout.name.maxLines,
  });

  let usedLogo = false;
  if (hasLogo && slots.logoSlot && logoDataUrl) {
    const fitted = containRect(logoW, logoH, slots.logoSlot);
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

  const colorRes = resolvePosterNameColor(
    input.primaryColor,
    layout.name.fallbackColor
  );
  const nameWarning = drawName(
    doc,
    input.pharmacyName,
    slots.nameSlot,
    layout,
    slots.nameMaxFontPt,
    colorRes.color
  );
  drawQrInZone(doc, input.qrDataUrl, layout);

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
}): Promise<PharmacyQrPosterBuildResult> {
  if (!isPrintSafePharmacyPublicUrl(input.publicUrl)) {
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
  const wantsLogo = Boolean(
    (input.logoDataUrl ?? input.logoUrl ?? '').toString().trim()
  );

  let logoDataUrl: string | null = input.logoDataUrl ?? null;
  let logoWidth = input.logoWidth;
  let logoHeight = input.logoHeight;

  const [backgroundDataUrl, qrDataUrl] = await Promise.all([
    input.backgroundDataUrl
      ? Promise.resolve(input.backgroundDataUrl)
      : loadImageAsDataUrl(backgroundSrc),
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
    format: 'a4',
    compress: true,
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
