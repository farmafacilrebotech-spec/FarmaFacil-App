/**
 * Cartel publicitario FarmaFácil (campaña «farmacia en el bolsillo»).
 * Composición programática con identidad corporativa + QR de la farmacia.
 * Sin Canva: se genera al vuelo desde datos actuales de la farmacia.
 */

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

import { isPrintSafePharmacyPublicUrl } from '@/lib/pharmacies/print-entrypoint-url';
import {
  POSTER_PAGE_MM,
  type PosterPageFormat,
} from '@/lib/pharmacies/pharmacy-qr-poster-layout';
import {
  ensurePosterNameFont,
  POSTER_NAME_FONT_FAMILY,
} from '@/lib/pharmacies/pharmacy-qr-poster-font';
import { containRect } from '@/lib/pharmacies/pharmacy-qr-poster-compose';
import {
  addImageClippedToCircle,
  drawStagingWatermark,
} from '@/lib/pharmacies/pharmacy-poster-pdf-helpers';
import { posterPdfTitle } from '@/lib/pharmacies/pharmacy-poster-meta';
import {
  AD_POSTER_BRAND,
  AD_POSTER_COPY,
  AD_POSTER_FF_MARK_SRC,
  AD_POSTER_PHONE_SCREEN_SRC,
  adPosterScale,
} from '@/lib/pharmacies/pharmacy-ad-poster-brand';

export {
  AD_POSTER_BRAND,
  AD_POSTER_COPY,
  AD_POSTER_FF_MARK_SRC,
  AD_POSTER_PHONE_SCREEN_SRC,
  adPosterScale,
} from '@/lib/pharmacies/pharmacy-ad-poster-brand';

export type PharmacyAdPosterBuildResult = {
  blob: Blob;
  format: PosterPageFormat;
  usedPharmacyLogo: boolean;
};

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
    throw new Error(`No se ha podido cargar el recurso gráfico (${src})`);
  }
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Recurso gráfico ilegible'));
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

/**
 * Dibuja el cartel publicitario en un documento jsPDF ya dimensionado.
 * Exportado para pruebas y pack de bienvenida.
 */
export async function drawPharmacyAdPoster(
  doc: jsPDF,
  input: {
    pharmacyName: string;
    qrDataUrl: string;
    markDataUrl: string;
    phoneScreenDataUrl: string;
    pharmacyLogoDataUrl?: string | null;
    /** Dimensiones reales del logo (evita deformarlo; contain en el cuadro). */
    pharmacyLogoWidth?: number;
    pharmacyLogoHeight?: number;
    format: PosterPageFormat;
    /** Entorno staging: marca de agua «PRUEBA - STAGING» (debajo del QR). */
    stagingWatermark?: boolean;
  }
): Promise<{ usedPharmacyLogo: boolean }> {
  const page = POSTER_PAGE_MM[input.format];
  const s = adPosterScale(input.format);
  const { widthMm: W, heightMm: H } = page;

  const black = hexToRgb(AD_POSTER_BRAND.black);
  const turquoise = hexToRgb(AD_POSTER_BRAND.turquoise);
  const white = hexToRgb(AD_POSTER_BRAND.white);
  const silver = hexToRgb(AD_POSTER_BRAND.silver);

  doc.setFillColor(black.r, black.g, black.b);
  doc.rect(0, 0, W, H, 'F');

  // Franja turquesa superior
  doc.setFillColor(turquoise.r, turquoise.g, turquoise.b);
  doc.rect(0, 0, W, 3.2 * s, 'F');

  let fontFamily = POSTER_NAME_FONT_FAMILY;
  try {
    fontFamily = await ensurePosterNameFont(doc);
  } catch {
    fontFamily = 'helvetica';
  }

  // Logo circular FarmaFácil
  const markSize = 28 * s;
  const markX = (W - markSize) / 2;
  const markY = 14 * s;
  doc.setFillColor(white.r, white.g, white.b);
  doc.circle(W / 2, markY + markSize / 2, markSize / 2 + 1.2 * s, 'F');
  // Recorte circular: el PNG oficial es cuadrado con esquinas negras opacas
  // (mismo criterio que BrandLogo en la UI).
  addImageClippedToCircle(doc, input.markDataUrl, 'PNG', markX, markY, markSize);

  // Headline
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(22 * s);
  doc.setTextColor(white.r, white.g, white.b);
  const headlineMaxW = W - 28 * s;
  const headlineLines = doc.splitTextToSize(AD_POSTER_COPY.headline, headlineMaxW);
  doc.text(headlineLines, W / 2, markY + markSize + 16 * s, {
    align: 'center',
    maxWidth: headlineMaxW,
  });

  // Smartphone grande
  const phoneW = 78 * s;
  const phoneH = 148 * s;
  const phoneX = (W - phoneW) / 2;
  const phoneY = markY + markSize + 38 * s;
  const radius = 6 * s;
  const bezel = 3.2 * s;

  doc.setFillColor(40, 40, 42);
  doc.roundedRect(phoneX, phoneY, phoneW, phoneH, radius, radius, 'F');
  doc.setFillColor(white.r, white.g, white.b);
  doc.roundedRect(
    phoneX + bezel,
    phoneY + bezel + 4 * s,
    phoneW - bezel * 2,
    phoneH - bezel * 2 - 10 * s,
    2.5 * s,
    2.5 * s,
    'F'
  );

  // Notch
  doc.setFillColor(20, 20, 22);
  doc.roundedRect(
    phoneX + phoneW * 0.32,
    phoneY + 2.2 * s,
    phoneW * 0.36,
    3.5 * s,
    1.2 * s,
    1.2 * s,
    'F'
  );

  const screenX = phoneX + bezel + 1.2 * s;
  const screenY = phoneY + bezel + 6 * s;
  const screenW = phoneW - bezel * 2 - 2.4 * s;
  const screenH = phoneH - bezel * 2 - 14 * s;
  try {
    doc.addImage(
      input.phoneScreenDataUrl,
      'PNG',
      screenX,
      screenY,
      screenW,
      screenH,
      undefined,
      'FAST'
    );
  } catch {
    doc.setFillColor(turquoise.r, turquoise.g, turquoise.b);
    doc.rect(screenX, screenY, screenW, screenH * 0.22, 'F');
  }

  // Pilares
  const pillarsY = phoneY + phoneH + 12 * s;
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(14 * s);
  doc.setTextColor(turquoise.r, turquoise.g, turquoise.b);
  doc.text(AD_POSTER_COPY.pillars, W / 2, pillarsY, { align: 'center' });

  // CTA
  doc.setFontSize(16 * s);
  doc.setTextColor(white.r, white.g, white.b);
  doc.text(AD_POSTER_COPY.cta, W / 2, pillarsY + 10 * s, { align: 'center' });

  // Nombre farmacia (+ logo farmacia opcional)
  let usedPharmacyLogo = false;
  const nameY = pillarsY + 22 * s;
  const nameMaxW = W - 36 * s;
  if (input.pharmacyLogoDataUrl) {
    const logoBox = 14 * s;
    try {
      const lw = input.pharmacyLogoWidth ?? 0;
      const lh = input.pharmacyLogoHeight ?? 0;
      // Sin dimensiones conocidas se mantiene el cuadro (comportamiento previo);
      // con dimensiones se ajusta en contain para no deformar el logo.
      const box = {
        x: W / 2 - logoBox / 2,
        y: nameY - logoBox - 2 * s,
        w: logoBox,
        h: logoBox,
      };
      const fitted = lw > 0 && lh > 0 ? containRect(lw, lh, box) : box;
      doc.addImage(
        input.pharmacyLogoDataUrl,
        input.pharmacyLogoDataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG',
        fitted.x,
        fitted.y,
        fitted.w,
        fitted.h,
        undefined,
        'NONE'
      );
      usedPharmacyLogo = true;
    } catch {
      usedPharmacyLogo = false;
    }
  }
  doc.setFont(fontFamily, 'bold');
  doc.setFontSize(13 * s);
  doc.setTextColor(silver.r, silver.g, silver.b);
  const nameLines = doc.splitTextToSize(
    input.pharmacyName.trim() || 'Farmacia',
    nameMaxW
  );
  doc.text(nameLines.slice(0, 2), W / 2, nameY + (usedPharmacyLogo ? 2 * s : 0), {
    align: 'center',
    maxWidth: nameMaxW,
  });

  // Marca de agua staging ANTES del QR para no degradar su lectura.
  if (input.stagingWatermark) {
    drawStagingWatermark(doc, page);
  }

  // QR con quiet zone blanca (legibilidad impresión)
  const qrOuter = 42 * s;
  const qrPad = 3.2 * s;
  const qrX = W - 16 * s - qrOuter;
  const qrY = H - 16 * s - qrOuter;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX, qrY, qrOuter, qrOuter, 2 * s, 2 * s, 'F');
  doc.addImage(
    input.qrDataUrl,
    'PNG',
    qrX + qrPad,
    qrY + qrPad,
    qrOuter - qrPad * 2,
    qrOuter - qrPad * 2,
    undefined,
    'NONE'
  );

  doc.setFont(fontFamily, 'normal');
  doc.setFontSize(8 * s);
  doc.setTextColor(silver.r, silver.g, silver.b);
  doc.text('Escanea para acceder', qrX + qrOuter / 2, qrY - 3 * s, {
    align: 'center',
  });

  // Pie identidad
  doc.setFontSize(7.5 * s);
  doc.setTextColor(turquoise.r, turquoise.g, turquoise.b);
  doc.text('FarmaFácil', 16 * s, H - 10 * s);

  return { usedPharmacyLogo };
}

export async function buildPharmacyAdPosterPdf(input: {
  pharmacyName: string;
  publicUrl: string;
  publicId: string;
  format?: PosterPageFormat;
  /** Logo farmacia opcional (no sustituye al mark FarmaFácil). */
  pharmacyLogoUrl?: string | null;
  /** Staging: marca de agua + metadatos «PRUEBA-STAGING». */
  staging?: boolean;
}): Promise<PharmacyAdPosterBuildResult> {
  if (!isPrintSafePharmacyPublicUrl(input.publicUrl)) {
    throw new Error(
      'La URL del QR no es la de producción. No se genera el cartel publicitario.'
    );
  }

  const format = input.format ?? 'a4';
  const page = POSTER_PAGE_MM[format];
  const qrPx = format === 'a3' ? 1600 : 1200;

  const wantsPharmacyLogo = Boolean(input.pharmacyLogoUrl?.trim());

  const [markDataUrl, phoneScreenDataUrl, qrDataUrl, pharmacyLogoDataUrl] =
    await Promise.all([
      loadImageAsDataUrl(AD_POSTER_FF_MARK_SRC),
      loadImageAsDataUrl(AD_POSTER_PHONE_SCREEN_SRC),
      QRCode.toDataURL(input.publicUrl, {
        width: qrPx,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: AD_POSTER_BRAND.black, light: '#ffffff' },
      }),
      wantsPharmacyLogo
        ? loadImageAsDataUrl(input.pharmacyLogoUrl!).catch(() => null)
        : Promise.resolve(null),
    ]);

  // Validar assets corporativos (obligatorios)
  await Promise.all([
    loadHtmlImage(markDataUrl),
    loadHtmlImage(phoneScreenDataUrl),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [page.widthMm, page.heightMm],
    compress: true,
  });

  // Logo ausente o ilegible → variante sin logo (misma composición).
  let logoW = 0;
  let logoH = 0;
  let logoForDraw = pharmacyLogoDataUrl;
  if (logoForDraw) {
    try {
      const img = await loadHtmlImage(logoForDraw);
      logoW = img.naturalWidth;
      logoH = img.naturalHeight;
    } catch {
      logoForDraw = null;
    }
  }

  doc.setProperties({
    title: posterPdfTitle({
      kind: 'publicitario',
      pharmacyName: input.pharmacyName,
      staging: input.staging,
    }),
  });

  const drawn = await drawPharmacyAdPoster(doc, {
    pharmacyName: input.pharmacyName,
    qrDataUrl,
    markDataUrl,
    phoneScreenDataUrl,
    pharmacyLogoDataUrl: logoForDraw,
    pharmacyLogoWidth: logoW,
    pharmacyLogoHeight: logoH,
    format,
    stagingWatermark: input.staging === true,
  });

  return {
    blob: doc.output('blob'),
    format,
    usedPharmacyLogo: drawn.usedPharmacyLogo,
  };
}
