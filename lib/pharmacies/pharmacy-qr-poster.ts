/**
 * Cartel PDF A4: plantilla Canva (fondo) + nombre + QR dinámicos.
 * No dibuja composición comercial en código.
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

import { isPrintSafePharmacyPublicUrl } from '@/lib/pharmacies/print-entrypoint-url';
import {
  isPharmacyQrPosterTemplateReady,
  PHARMACY_QR_POSTER_LAYOUT,
  PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE,
  type PharmacyQrPosterLayout,
  type PosterRectMm,
} from '@/lib/pharmacies/pharmacy-qr-poster-layout';

export {
  isPharmacyQrPosterTemplateReady,
  PHARMACY_QR_POSTER_LAYOUT,
  PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE,
} from '@/lib/pharmacies/pharmacy-qr-poster-layout';

async function loadImageAsDataUrl(src: string): Promise<string> {
  const absolute =
    src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')
      ? src
      : typeof window !== 'undefined'
        ? `${window.location.origin}${src.startsWith('/') ? src : `/${src}`}`
        : src;

  const res = await fetch(absolute);
  if (!res.ok) {
    throw new Error('No se ha podido cargar la plantilla del cartel');
  }
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Plantilla del cartel ilegible'));
    reader.readAsDataURL(blob);
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

function drawNameInZone(
  doc: jsPDF,
  pharmacyName: string,
  layout: PharmacyQrPosterLayout
): void {
  const { rect, fontSizePt, color, align, fontStyle } = layout.name;
  const rgb = hexToRgb(color);
  doc.setFont('helvetica', fontStyle);
  doc.setFontSize(fontSizePt);
  doc.setTextColor(rgb.r, rgb.g, rgb.b);

  const text = pharmacyName.trim() || 'Farmacia';
  const lines = doc.splitTextToSize(text, Math.max(rect.w, 1));
  const lineH = fontSizePt * 0.4; // mm approx from pt
  const blockH = lines.length * lineH;
  const startY = rect.y + Math.max((rect.h - blockH) / 2, 0) + lineH * 0.85;

  let x = rect.x;
  if (align === 'center') x = rect.x + rect.w / 2;
  if (align === 'right') x = rect.x + rect.w;

  doc.text(lines, x, startY, { align, maxWidth: rect.w });
}

function drawQrInZone(
  doc: jsPDF,
  qrDataUrl: string,
  rect: PosterRectMm
): void {
  const size = Math.min(rect.w, rect.h);
  const x = rect.x + (rect.w - size) / 2;
  const y = rect.y + (rect.h - size) / 2;
  doc.addImage(qrDataUrl, 'PNG', x, y, size, size, undefined, 'FAST');
}

/** Compone el PDF: fondo Canva + nombre + QR. */
export function drawPharmacyQrPosterFromTemplate(
  doc: jsPDF,
  input: {
    pharmacyName: string;
    backgroundDataUrl: string;
    qrDataUrl: string;
    layout?: PharmacyQrPosterLayout;
  }
): void {
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
  drawNameInZone(doc, input.pharmacyName, layout);
  drawQrInZone(doc, input.qrDataUrl, layout.qr.rect);
}

export async function buildPharmacyQrPosterPdf(input: {
  pharmacyName: string;
  publicUrl: string;
  publicId: string;
  /** Override de layout (tests). */
  layout?: PharmacyQrPosterLayout;
  /** Data URL de plantilla ya cargada (tests / scripts). */
  backgroundDataUrl?: string;
}): Promise<Blob> {
  if (!isPrintSafePharmacyPublicUrl(input.publicUrl)) {
    throw new Error(
      'La URL del QR no es la de producción. No se genera el cartel.'
    );
  }

  const layout = input.layout ?? PHARMACY_QR_POSTER_LAYOUT;
  if (!isPharmacyQrPosterTemplateReady(layout)) {
    throw new Error(PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE);
  }

  const backgroundSrc = layout.backgroundSrc!;
  const [backgroundDataUrl, qrDataUrl] = await Promise.all([
    input.backgroundDataUrl
      ? Promise.resolve(input.backgroundDataUrl)
      : loadImageAsDataUrl(backgroundSrc),
    QRCode.toDataURL(input.publicUrl, {
      width: 960,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0B0B0B', light: '#ffffff' },
    }),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  drawPharmacyQrPosterFromTemplate(doc, {
    pharmacyName: input.pharmacyName,
    backgroundDataUrl,
    qrDataUrl,
    layout,
  });

  return doc.output('blob');
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
