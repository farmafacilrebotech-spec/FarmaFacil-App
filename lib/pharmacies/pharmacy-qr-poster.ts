/**
 * Cartel PDF A4: plantilla Canva (fondo) + logo + nombre + QR dinámicos.
 * No redibuja la composición comercial de Canva.
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

import { isPrintSafePharmacyPublicUrl } from '@/lib/pharmacies/print-entrypoint-url';
import { fitPharmacyNameInZone, ptToMm } from '@/lib/pharmacies/pharmacy-qr-poster-fit';
import {
  containRect,
  isPharmacyQrPosterDownloadEnabled,
  isPharmacyQrPosterTemplateReady,
  PHARMACY_QR_POSTER_AWAITING_APPROVAL_MESSAGE,
  PHARMACY_QR_POSTER_LAYOUT,
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
  PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE,
} from '@/lib/pharmacies/pharmacy-qr-poster-layout';

export type PharmacyQrPosterBuildResult = {
  blob: Blob;
  nameWarning: string | null;
  usedLogo: boolean;
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
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se ha podido decodificar la imagen'));
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

function resolveNameZoneMm(
  layout: PharmacyQrPosterLayout,
  hasLogo: boolean
): PosterRectMm {
  const norm =
    !hasLogo && layout.name.rectWithoutLogo
      ? layout.name.rectWithoutLogo
      : layout.name.rect;
  return rectNormToMm(norm, layout.page);
}

function drawFittedName(
  doc: jsPDF,
  pharmacyName: string,
  layout: PharmacyQrPosterLayout,
  hasLogo: boolean
): string | null {
  const zoneMm = resolveNameZoneMm(layout, hasLogo);
  const fit = fitPharmacyNameInZone(doc, pharmacyName, zoneMm, layout.name);
  const rgb = hexToRgb(layout.name.color);

  doc.setFont('helvetica', layout.name.fontStyle);
  doc.setFontSize(fit.fontSizePt);
  doc.setTextColor(rgb.r, rgb.g, rgb.b);

  const lineH = ptToMm(fit.fontSizePt) * 1.2;
  const blockH = fit.lines.length * lineH;
  const startY = zoneMm.y + Math.max((zoneMm.h - blockH) / 2, 0) + lineH * 0.8;

  let x = zoneMm.x;
  if (layout.name.align === 'center') x = zoneMm.x + zoneMm.w / 2;
  if (layout.name.align === 'right') x = zoneMm.x + zoneMm.w;

  doc.text(fit.lines, x, startY, {
    align: layout.name.align,
    maxWidth: zoneMm.w,
  });

  return fit.warning;
}

async function drawLogoContain(
  doc: jsPDF,
  logoDataUrl: string,
  box: PosterRectMm
): Promise<boolean> {
  try {
    const img = await loadHtmlImage(logoDataUrl);
    const fitted = containRect(img.naturalWidth, img.naturalHeight, box);
    if (fitted.w <= 0 || fitted.h <= 0) return false;
    const format = logoDataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
    doc.addImage(
      logoDataUrl,
      format,
      fitted.x,
      fitted.y,
      fitted.w,
      fitted.h,
      undefined,
      'FAST'
    );
    return true;
  } catch {
    return false;
  }
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
    'FAST'
  );
}

/** Compone el PDF sobre la plantilla Canva. */
export async function drawPharmacyQrPosterFromTemplate(
  doc: jsPDF,
  input: {
    pharmacyName: string;
    backgroundDataUrl: string;
    qrDataUrl: string;
    logoDataUrl?: string | null;
    layout?: PharmacyQrPosterLayout;
  }
): Promise<{ nameWarning: string | null; usedLogo: boolean }> {
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
    'FAST'
  );

  let usedLogo = false;
  if (input.logoDataUrl?.trim() && layout.logo.configured) {
    const logoBox = rectNormToMm(layout.logo.rect, layout.page);
    usedLogo = await drawLogoContain(doc, input.logoDataUrl, logoBox);
  }

  const nameWarning = drawFittedName(
    doc,
    input.pharmacyName,
    layout,
    usedLogo
  );
  drawQrInZone(doc, input.qrDataUrl, layout);

  return { nameWarning, usedLogo };
}

export async function buildPharmacyQrPosterPdf(input: {
  pharmacyName: string;
  publicUrl: string;
  publicId: string;
  /** logo_url de pharmacy_branding (nunca FarmaFácil de sustituto). */
  logoUrl?: string | null;
  layout?: PharmacyQrPosterLayout;
  backgroundDataUrl?: string;
  logoDataUrl?: string | null;
  /**
   * Si true, permite generar aunque pdfDownloadEnabled=false
   * (solo scripts de revisión / aprobación visual).
   */
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
  const logoSrc = input.logoDataUrl ?? input.logoUrl ?? null;

  const [backgroundDataUrl, qrDataUrl, logoDataUrl] = await Promise.all([
    input.backgroundDataUrl
      ? Promise.resolve(input.backgroundDataUrl)
      : loadImageAsDataUrl(backgroundSrc),
    QRCode.toDataURL(input.publicUrl, {
      width: 1200,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0B0B0B', light: '#ffffff' },
    }),
    logoSrc
      ? loadImageAsDataUrl(logoSrc).catch(() => null)
      : Promise.resolve(null),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const { nameWarning, usedLogo } = await drawPharmacyQrPosterFromTemplate(doc, {
    pharmacyName: input.pharmacyName,
    backgroundDataUrl,
    qrDataUrl,
    logoDataUrl,
    layout,
  });

  return {
    blob: doc.output('blob'),
    nameWarning,
    usedLogo,
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
