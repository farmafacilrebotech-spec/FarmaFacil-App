/**
 * Cartel comercial A4 vertical (PDF) con logo circular, nombre y QR real.
 * URL del QR debe ser canónica de producción (ver print-entrypoint-url).
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

import { isPrintSafePharmacyPublicUrl } from '@/lib/pharmacies/print-entrypoint-url';

const TEAL = { r: 13, g: 148, b: 136 }; // #0d9488
const INK = { r: 15, g: 23, b: 42 }; // #0f172a

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

export async function buildPharmacyQrPosterPdf(input: {
  pharmacyName: string;
  publicUrl: string;
  publicId: string;
  /** Ruta pública del logo circular oficial (p. ej. /images/logos/farmafacil-logo-512.png). */
  logoUrl?: string;
}): Promise<Blob> {
  if (!isPrintSafePharmacyPublicUrl(input.publicUrl)) {
    throw new Error(
      'La URL del QR no es la de producción. No se genera el cartel.'
    );
  }

  const logoSrc =
    input.logoUrl ??
    (typeof window !== 'undefined'
      ? `${window.location.origin}/images/logos/farmafacil-logo-512.png`
      : '/images/logos/farmafacil-logo-512.png');

  const [logoDataUrl, qrDataUrl] = await Promise.all([
    loadImageAsDataUrl(logoSrc),
    QRCode.toDataURL(input.publicUrl, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    }),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;

  // Fondo blanco + franja superior turquesa
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setFillColor(TEAL.r, TEAL.g, TEAL.b);
  doc.rect(0, 0, pageW, 8, 'F');
  doc.rect(0, pageH - 8, pageW, 8, 'F');

  // Logo circular
  const logoSize = 42;
  const logoX = (pageW - logoSize) / 2;
  const logoY = 22;
  doc.addImage(logoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);

  // Marca
  doc.setTextColor(INK.r, INK.g, INK.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('FARMAFÁCIL', pageW / 2, logoY + logoSize + 10, {
    align: 'center',
  });

  // Nombre farmacia
  doc.setFontSize(20);
  const nameLines = doc.splitTextToSize(
    input.pharmacyName.trim() || 'Farmacia',
    pageW - margin * 2
  );
  doc.text(nameLines, pageW / 2, logoY + logoSize + 24, { align: 'center' });

  // QR
  const qrSize = 95;
  const qrX = (pageW - qrSize) / 2;
  const qrY = Math.min(logoY + logoSize + 24 + nameLines.length * 9 + 10, 105);
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

  // Textos pie
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(TEAL.r, TEAL.g, TEAL.b);
  doc.text('Escanea para ver el catálogo y pedir', pageW / 2, qrY + qrSize + 12, {
    align: 'center',
  });

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text(input.publicUrl, pageW / 2, qrY + qrSize + 20, {
    align: 'center',
    maxWidth: pageW - margin * 2,
  });

  doc.setFontSize(7);
  doc.text(
    'Código oficial FarmaFácil · No comparte datos personales al escanear',
    pageW / 2,
    pageH - 14,
    { align: 'center' }
  );

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
