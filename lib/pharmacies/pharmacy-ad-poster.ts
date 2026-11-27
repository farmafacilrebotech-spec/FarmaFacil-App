/**
 * Plantilla 3 · Cartel publicitario FarmaFácil (A4 / A3).
 *
 * Fondo corporativo `cartel-publicitario-a3.png` (arte nativo A3, 3508×4961)
 * + overlays dinámicos (logo, nombre, QR), igual que el cartel QR. Los
 * placeholders grises del original («[LOGO FARMACIA]», «[NOMBRE VISIBLE
 * FARMACIA]») se tapan con relleno opaco ANTES de dibujar el contenido.
 * Ya NO se compone programáticamente (sin teléfono/pilares dibujados).
 */

import { jsPDF } from 'jspdf';

import { isMaterialSafePharmacyPublicUrl } from '@/lib/pharmacies/print-entrypoint-url';
import {
  pharmacyAdPosterLayout,
  POSTER_PAGE_MM,
  type PharmacyQrPosterLayout,
  type PosterPageFormat,
} from '@/lib/pharmacies/pharmacy-qr-poster-layout';
import {
  buildPosterQrDataUrl,
  drawPharmacyQrPosterFromTemplate,
  loadPosterBackground,
  loadPosterLogoAsset,
} from '@/lib/pharmacies/pharmacy-qr-poster';
import { posterPdfTitle } from '@/lib/pharmacies/pharmacy-poster-meta';

export {
  AD_POSTER_BRAND,
  AD_POSTER_COPY,
  AD_POSTER_FF_MARK_SRC,
  AD_POSTER_PHONE_SCREEN_SRC,
  adPosterScale,
} from '@/lib/pharmacies/pharmacy-ad-poster-brand';

/** Formatos soportados del cartel publicitario. */
export type AdPosterFormat = Extract<PosterPageFormat, 'a4' | 'a3'>;

export type PharmacyAdPosterBuildResult = {
  blob: Blob;
  format: AdPosterFormat;
  usedPharmacyLogo: boolean;
  nameWarning: string | null;
};

function normalizeAdFormat(format: PosterPageFormat | undefined): AdPosterFormat {
  return format === 'a3' ? 'a3' : 'a4';
}

/**
 * Dibuja el cartel publicitario en un documento jsPDF ya dimensionado
 * (página activa). Exportado para pruebas y pack de bienvenida.
 */
export async function drawPharmacyAdPoster(
  doc: jsPDF,
  input: {
    pharmacyName: string;
    qrDataUrl: string;
    backgroundDataUrl: string;
    pharmacyLogoDataUrl?: string | null;
    /** Dimensiones reales del logo (contain en el hueco, sin deformar). */
    pharmacyLogoWidth?: number;
    pharmacyLogoHeight?: number;
    primaryColor?: string | null;
    format: PosterPageFormat;
    /** Entorno staging: marca de agua «PRUEBA - STAGING» (antes del QR). */
    stagingWatermark?: boolean;
    /** Logo ya recortado (evita repetir el trim). */
    logoPreTrimmed?: boolean;
    layout?: PharmacyQrPosterLayout;
  }
): Promise<{ usedPharmacyLogo: boolean; nameWarning: string | null }> {
  const layout = input.layout ?? pharmacyAdPosterLayout(normalizeAdFormat(input.format));
  const drawn = await drawPharmacyQrPosterFromTemplate(doc, {
    pharmacyName: input.pharmacyName,
    backgroundDataUrl: input.backgroundDataUrl,
    qrDataUrl: input.qrDataUrl,
    logoDataUrl: input.pharmacyLogoDataUrl ?? null,
    logoWidth: input.pharmacyLogoWidth,
    logoHeight: input.pharmacyLogoHeight,
    logoPreTrimmed: input.logoPreTrimmed,
    primaryColor: input.primaryColor,
    layout,
    stagingWatermark: input.stagingWatermark === true,
  });
  return { usedPharmacyLogo: drawn.usedLogo, nameWarning: drawn.nameWarning };
}

export async function buildPharmacyAdPosterPdf(input: {
  pharmacyName: string;
  publicUrl: string;
  publicId: string;
  format?: PosterPageFormat;
  /** Logo farmacia opcional (sin logo, la caja del logo se funde con el fondo). */
  pharmacyLogoUrl?: string | null;
  primaryColor?: string | null;
  /** Staging: permite QR de staging + marca de agua + metadatos de prueba. */
  staging?: boolean;
}): Promise<PharmacyAdPosterBuildResult> {
  if (
    !isMaterialSafePharmacyPublicUrl(input.publicUrl, {
      allowStaging: input.staging === true,
    })
  ) {
    throw new Error(
      'La URL del QR no es válida para material. No se genera el cartel publicitario.'
    );
  }

  const format = normalizeAdFormat(input.format);
  const layout = pharmacyAdPosterLayout(format);
  const page = POSTER_PAGE_MM[format];
  const qrPx = format === 'a3' ? 1600 : 1200;

  const [backgroundDataUrl, qrDataUrl, logo] = await Promise.all([
    loadPosterBackground(layout),
    buildPosterQrDataUrl(input.publicUrl, qrPx),
    // Logo ausente o ilegible → variante sin logo (misma composición).
    loadPosterLogoAsset(input.pharmacyLogoUrl).catch(() => null),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [page.widthMm, page.heightMm],
    compress: true,
  });
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
    backgroundDataUrl,
    pharmacyLogoDataUrl: logo?.dataUrl ?? null,
    pharmacyLogoWidth: logo?.width,
    pharmacyLogoHeight: logo?.height,
    logoPreTrimmed: true,
    primaryColor: input.primaryColor,
    format,
    layout,
    stagingWatermark: input.staging === true,
  });

  return {
    blob: doc.output('blob'),
    format,
    usedPharmacyLogo: drawn.usedPharmacyLogo,
    nameWarning: drawn.nameWarning,
  };
}
