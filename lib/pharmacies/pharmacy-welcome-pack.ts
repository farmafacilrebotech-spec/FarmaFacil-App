/**
 * Pack de bienvenida: PDF multipágina con material publicitario.
 * Datos siempre en vivo (nombre, logo, acceso público). Sin contratos inventados.
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

import {
  AD_POSTER_FF_MARK_SRC,
  AD_POSTER_PHONE_SCREEN_SRC,
} from '@/lib/pharmacies/pharmacy-ad-poster-brand';
import { drawPharmacyAdPoster } from '@/lib/pharmacies/pharmacy-ad-poster';
import { isPrintSafePharmacyPublicUrl } from '@/lib/pharmacies/print-entrypoint-url';
import {
  drawPharmacyQrPosterFromTemplate,
  downloadBlob,
} from '@/lib/pharmacies/pharmacy-qr-poster';
import {
  POSTER_PAGE_MM,
  pharmacyQrPosterLayoutForFormat,
  type PosterPageFormat,
} from '@/lib/pharmacies/pharmacy-qr-poster-layout';

export type WelcomePackContractSlot =
  | { available: true; note?: string }
  | { available: false; reason: string };

export type WelcomePackInput = {
  pharmacyName: string;
  publicUrl: string;
  publicId: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  contract?: WelcomePackContractSlot | null;
  formats?: PosterPageFormat[];
};

export type WelcomePackResult = {
  blob: Blob;
  filename: string;
  pages: number;
  contractIncluded: boolean;
  contractNote: string | null;
};

export function defaultWelcomePackContractSlot(): WelcomePackContractSlot {
  return {
    available: false,
    reason:
      'La formalización contractual está pendiente de validación jurídica. Todavía no se incluye un contrato en el pack.',
  };
}

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
  if (!res.ok) throw new Error(`No se ha podido cargar ${src}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Imagen ilegible'));
    reader.readAsDataURL(blob);
  });
}

function loadHtmlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Imagen no decodificable'));
    img.src = dataUrl;
  });
}

export async function buildPharmacyWelcomePackPdf(
  input: WelcomePackInput
): Promise<WelcomePackResult> {
  if (!isPrintSafePharmacyPublicUrl(input.publicUrl)) {
    throw new Error(
      'La URL del QR no es la de producción. No se genera el pack.'
    );
  }

  const formats = input.formats?.length
    ? input.formats
    : (['a4', 'a3'] as PosterPageFormat[]);
  const contract = input.contract ?? defaultWelcomePackContractSlot();

  const layoutA4 = pharmacyQrPosterLayoutForFormat('a4');
  const backgroundSrc = layoutA4.backgroundSrc!;
  const wantsLogo = Boolean(input.logoUrl?.trim());

  const [backgroundDataUrl, markDataUrl, phoneScreenDataUrl, qrDataUrl] =
    await Promise.all([
      loadImageAsDataUrl(backgroundSrc),
      loadImageAsDataUrl(AD_POSTER_FF_MARK_SRC),
      loadImageAsDataUrl(AD_POSTER_PHONE_SCREEN_SRC),
      QRCode.toDataURL(input.publicUrl, {
        width: 1400,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#0B0B0B', light: '#ffffff' },
      }),
    ]);

  let logoDataUrl: string | null = null;
  let logoWidth = 0;
  let logoHeight = 0;
  if (wantsLogo) {
    try {
      logoDataUrl = await loadImageAsDataUrl(input.logoUrl!);
      const img = await loadHtmlImage(logoDataUrl);
      logoWidth = img.naturalWidth;
      logoHeight = img.naturalHeight;
    } catch {
      throw new Error(
        'No se ha podido cargar el logo de la farmacia. Revisa Personalización.'
      );
    }
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  // Portada
  doc.setFillColor(11, 11, 11);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setTextColor(26, 187, 179);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Pack de bienvenida FarmaFácil', 105, 42, { align: 'center' });
  doc.setTextColor(247, 249, 250);
  doc.setFontSize(14);
  doc.text(input.pharmacyName, 105, 58, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(197, 204, 211);
  const intro = [
    'Material generado automáticamente con los datos actuales',
    'de la farmacia. Si cambias el nombre, el logotipo o el acceso',
    'público, vuelve a descargar el pack para obtener la versión',
    'actualizada. No se crean accesos públicos nuevos.',
    '',
    'Contenido de este PDF:',
    ...formats.flatMap((f) => [
      `· Cartel de acceso QR (${f.toUpperCase()})`,
      `· Cartel publicitario «farmacia en el bolsillo» (${f.toUpperCase()})`,
    ]),
  ];
  let y = 80;
  for (const line of intro) {
    doc.text(line, 24, y);
    y += 7;
  }
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 187, 179);
  doc.text('Contrato', 24, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(247, 249, 250);
  if (contract.available) {
    doc.text(
      contract.note ||
        'La documentación contractual autorizada se gestiona aparte.',
      24,
      y,
      { maxWidth: 162 }
    );
  } else {
    const reasonLines = doc.splitTextToSize(contract.reason, 162);
    doc.text(reasonLines, 24, y);
  }

  let pages = 1;

  for (const format of formats) {
    const layout = pharmacyQrPosterLayoutForFormat(format);
    const page = POSTER_PAGE_MM[format];
    doc.addPage([page.widthMm, page.heightMm], 'portrait');
    pages += 1;
    await drawPharmacyQrPosterFromTemplate(doc, {
      pharmacyName: input.pharmacyName,
      backgroundDataUrl,
      qrDataUrl,
      logoDataUrl,
      logoWidth,
      logoHeight,
      primaryColor: input.primaryColor,
      layout,
    });

    doc.addPage([page.widthMm, page.heightMm], 'portrait');
    pages += 1;
    await drawPharmacyAdPoster(doc, {
      pharmacyName: input.pharmacyName,
      qrDataUrl,
      markDataUrl,
      phoneScreenDataUrl,
      pharmacyLogoDataUrl: logoDataUrl,
      format,
    });
  }

  const safe =
    input.publicId.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'farmacia';

  return {
    blob: doc.output('blob'),
    filename: `farmafacil-pack-bienvenida-${safe}.pdf`,
    pages,
    contractIncluded: contract.available,
    contractNote: contract.available ? null : contract.reason,
  };
}

export async function downloadWelcomePack(
  input: WelcomePackInput
): Promise<WelcomePackResult> {
  const result = await buildPharmacyWelcomePackPdf(input);
  downloadBlob(result.filename, result.blob);
  return result;
}

export function openPdfBlob(blob: Blob): Window | null {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return win;
}

export function printPdfBlob(blob: Blob): void {
  const win = openPdfBlob(blob);
  if (!win) return;
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* impresión manual desde la pestaña */
    }
  }, 800);
}
