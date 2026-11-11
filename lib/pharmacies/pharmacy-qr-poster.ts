/**
 * Cartel comercial A4 vertical (PDF) para escaparate / mostrador.
 * Logo: PNG oficial recortado en círculo (mismo criterio que BrandLogo).
 * QR: URL canónica de producción únicamente.
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

import { isPrintSafePharmacyPublicUrl } from '@/lib/pharmacies/print-entrypoint-url';
import {
  POSTER_COLORS,
  POSTER_COPY,
} from '@/lib/pharmacies/pharmacy-qr-poster-copy';

export { POSTER_COLORS, POSTER_COPY };

const OFFICIAL_LOGO_PATH = '/images/logos/farmafacil-logo-512.png';

async function loadImageAsDataUrl(src: string): Promise<string> {
  const res = await fetch(src);
  if (!res.ok) throw new Error('No se ha podido cargar el logo');
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Logo ilegible'));
    reader.readAsDataURL(blob);
  });
}

function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se ha podido decodificar el logo'));
    img.src = dataUrl;
  });
}

/**
 * Recorta el PNG oficial (cuadrado con fondo negro fuera del aro) a círculo.
 * Compone sobre blanco: el logo vive sobre fondo blanco del cartel y jsPDF
 * no depende de alpha PNG.
 */
export async function circularizeOfficialLogoDataUrl(
  logoDataUrl: string,
  sizePx = 640
): Promise<string> {
  const img = await loadHtmlImage(logoDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible para el logo');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sizePx, sizePx);
  ctx.beginPath();
  ctx.arc(sizePx / 2, sizePx / 2, sizePx / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, 0, 0, sizePx, sizePx);
  return canvas.toDataURL('image/png');
}

function fillRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  color: { r: number; g: number; b: number }
) {
  doc.setFillColor(color.r, color.g, color.b);
  doc.rect(x, y, w, h, 'F');
}

/** Dibuja el cartel en un jsPDF A4 ya creado (testable / reutilizable). */
export function drawPharmacyQrPoster(
  doc: jsPDF,
  input: {
    pharmacyName: string;
    logoDataUrl: string;
    qrDataUrl: string;
  }
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const side = 16;
  const contentW = pageW - side * 2;
  const { black, teal, white, softGray, muted } = POSTER_COLORS;

  fillRect(doc, 0, 0, pageW, pageH, white);

  // Cabecera
  fillRect(doc, 0, 0, pageW, 14, black);
  fillRect(doc, 0, 14, pageW, 2.5, teal);

  let y = 26;

  // Logo circular oficial (sobre blanco)
  const logoSize = 44;
  const logoX = (pageW - logoSize) / 2;
  doc.addImage(
    input.logoDataUrl,
    'PNG',
    logoX,
    y,
    logoSize,
    logoSize,
    undefined,
    'FAST'
  );
  y += logoSize + 10;

  // Titular
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(black.r, black.g, black.b);
  const headlineLines = doc.splitTextToSize(POSTER_COPY.headline, contentW);
  doc.text(headlineLines, pageW / 2, y, { align: 'center' });
  y += headlineLines.length * 9 + 5;

  // Nombre farmacia
  doc.setFontSize(15);
  doc.setTextColor(teal.r, teal.g, teal.b);
  const nameLines = doc.splitTextToSize(
    input.pharmacyName.trim() || 'Farmacia',
    contentW
  );
  doc.text(nameLines, pageW / 2, y, { align: 'center' });
  y += nameLines.length * 6.5 + 7;

  // Beneficios
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(muted.r, muted.g, muted.b);
  const benefitLines = doc.splitTextToSize(
    POSTER_COPY.benefits,
    contentW * 0.92
  );
  doc.text(benefitLines, pageW / 2, y, { align: 'center' });
  y += benefitLines.length * 5.4 + 9;

  // Panel QR
  const qrPanelPad = 7;
  const qrSize = 108;
  const panelW = qrSize + qrPanelPad * 2;
  const panelH = qrSize + qrPanelPad * 2;
  const panelX = (pageW - panelW) / 2;
  const maxPanelY = pageH - 52 - panelH;
  const panelY = Math.min(Math.max(y, 112), maxPanelY);

  fillRect(doc, panelX, panelY, panelW, panelH, softGray);
  doc.setDrawColor(teal.r, teal.g, teal.b);
  doc.setLineWidth(0.45);
  doc.roundedRect(panelX, panelY, panelW, panelH, 3, 3, 'S');

  doc.addImage(
    input.qrDataUrl,
    'PNG',
    panelX + qrPanelPad,
    panelY + qrPanelPad,
    qrSize,
    qrSize,
    undefined,
    'FAST'
  );

  y = panelY + panelH + 11;

  // CTA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(black.r, black.g, black.b);
  doc.text(POSTER_COPY.cta, pageW / 2, y, { align: 'center' });
  y += 6;

  const accentW = 40;
  fillRect(doc, (pageW - accentW) / 2, y, accentW, 1.3, teal);

  // Pie
  fillRect(doc, 0, pageH - 16, pageW, 16, black);
  fillRect(doc, 0, pageH - 16, pageW, 1.2, teal);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(white.r, white.g, white.b);
  doc.text(POSTER_COPY.footer, pageW / 2, pageH - 7, { align: 'center' });
}

export async function buildPharmacyQrPosterPdf(input: {
  pharmacyName: string;
  publicUrl: string;
  publicId: string;
  /** Ruta pública del logo oficial (por defecto farmafacil-logo-512.png). */
  logoUrl?: string;
  /** Data URL del logo ya cargado (evita fetch; útil en scripts). */
  logoDataUrl?: string;
  /** Data URL del logo ya circularizado (salta canvas del navegador). */
  circularLogoDataUrl?: string;
}): Promise<Blob> {
  if (!isPrintSafePharmacyPublicUrl(input.publicUrl)) {
    throw new Error(
      'La URL del QR no es la de producción. No se genera el cartel.'
    );
  }

  const qrDataUrl = await QRCode.toDataURL(input.publicUrl, {
    width: 960,
    margin: 3,
    errorCorrectionLevel: 'M',
    color: { dark: '#0B0B0B', light: '#ffffff' },
  });

  let logoDataUrl = input.circularLogoDataUrl;
  if (!logoDataUrl) {
    const raw =
      input.logoDataUrl ??
      (await loadImageAsDataUrl(
        input.logoUrl ??
          (typeof window !== 'undefined'
            ? `${window.location.origin}${OFFICIAL_LOGO_PATH}`
            : OFFICIAL_LOGO_PATH)
      ));
    logoDataUrl = await circularizeOfficialLogoDataUrl(raw, 640);
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  drawPharmacyQrPoster(doc, {
    pharmacyName: input.pharmacyName,
    logoDataUrl,
    qrDataUrl,
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
