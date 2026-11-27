/**
 * Pliego de flyers A6 sobre páginas A4 (flyers a tamaño real 105×148 mm,
 * 2×2 por página; 10 flyers → 3 páginas: 4 + 4 + 2) con guías de corte
 * hairline gris claro. Cada flyer = mismo contenido personalizado que el
 * flyer individual (logo + nombre + QR). Marca de agua staging UNA vez por
 * página (discreta, antes de los QR para no degradarlos).
 */

import { jsPDF } from 'jspdf';

import { isMaterialSafePharmacyPublicUrl } from '@/lib/pharmacies/print-entrypoint-url';
import {
  drawFlyerCutGuides,
  FLYER_SHEET_DEFAULT_COUNT,
  FLYER_SHEET_PAGE_MM,
  flyerSheetPageCount,
  flyerSheetPlacements,
} from '@/lib/pharmacies/pharmacy-flyer-sheet-grid';
import { pharmacyFlyerLayout } from '@/lib/pharmacies/pharmacy-qr-poster-layout';
import {
  buildPosterQrDataUrl,
  drawPharmacyQrPosterFromTemplate,
  drawPosterQr,
  loadPosterBackground,
  loadPosterLogoAsset,
  type PosterLogoAsset,
} from '@/lib/pharmacies/pharmacy-qr-poster';
import { drawStagingWatermark } from '@/lib/pharmacies/pharmacy-poster-pdf-helpers';
import { posterPdfTitle } from '@/lib/pharmacies/pharmacy-poster-meta';

export {
  FLYER_SHEET_DEFAULT_COUNT,
  FLYER_SHEET_PER_PAGE,
  flyerSheetPageCount,
  flyerSheetPlacements,
} from '@/lib/pharmacies/pharmacy-flyer-sheet-grid';

export type PharmacyFlyerSheetBuildResult = {
  blob: Blob;
  pages: number;
  flyers: number;
  usedLogo: boolean;
  nameWarning: string | null;
};

type SheetAssets = {
  backgroundDataUrl: string;
  qrDataUrl: string;
  logo: PosterLogoAsset | null;
};

/**
 * Dibuja `count` flyers en `doc` a partir de la página actual (la primera
 * página del pliego es la página activa; el resto se añaden). Devuelve nº de
 * páginas usadas. Exportado para el pack de bienvenida.
 */
export async function drawPharmacyFlyerSheetPages(
  doc: jsPDF,
  input: {
    pharmacyName: string;
    primaryColor?: string | null;
    assets: SheetAssets;
    count?: number;
    staging?: boolean;
  }
): Promise<{ pages: number; usedLogo: boolean; nameWarning: string | null }> {
  const count = Math.max(input.count ?? FLYER_SHEET_DEFAULT_COUNT, 1);
  const layout = pharmacyFlyerLayout();
  const placements = flyerSheetPlacements(count);
  const pages = flyerSheetPageCount(count);
  const { assets } = input;
  let usedLogo = false;
  let nameWarning: string | null = null;

  for (let page = 0; page < pages; page++) {
    if (page > 0) {
      doc.addPage(
        [FLYER_SHEET_PAGE_MM.widthMm, FLYER_SHEET_PAGE_MM.heightMm],
        'portrait'
      );
    }
    const tiles = placements.filter((p) => p.page === page);

    // Fase 1: fondo + logo + nombre de cada flyer (sin QR).
    for (const t of tiles) {
      const drawn = await drawPharmacyQrPosterFromTemplate(doc, {
        pharmacyName: input.pharmacyName,
        backgroundDataUrl: assets.backgroundDataUrl,
        qrDataUrl: assets.qrDataUrl,
        logoDataUrl: assets.logo?.dataUrl ?? null,
        logoWidth: assets.logo?.width,
        logoHeight: assets.logo?.height,
        logoPreTrimmed: true,
        primaryColor: input.primaryColor,
        layout,
        origin: { xMm: t.xMm, yMm: t.yMm },
        skipQr: true,
      });
      usedLogo = usedLogo || drawn.usedLogo;
      nameWarning = nameWarning ?? drawn.nameWarning;
    }

    // Guías de corte (hairline) entre flyers.
    drawFlyerCutGuides(doc, tiles.length);

    // Marca de agua staging una sola vez por página, antes de los QR.
    if (input.staging) {
      drawStagingWatermark(doc, FLYER_SHEET_PAGE_MM);
    }

    // Fase 2: QR nítidos por encima de la marca de agua.
    for (const t of tiles) {
      drawPosterQr(doc, assets.qrDataUrl, layout, { xMm: t.xMm, yMm: t.yMm });
    }
  }

  return { pages, usedLogo, nameWarning };
}

export async function buildPharmacyFlyerSheetPdf(input: {
  pharmacyName: string;
  publicUrl: string;
  publicId: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  /** Nº de flyers (default 10). */
  count?: number;
  /** Staging: permite QR de staging + marca de agua + metadatos de prueba. */
  staging?: boolean;
}): Promise<PharmacyFlyerSheetBuildResult> {
  if (
    !isMaterialSafePharmacyPublicUrl(input.publicUrl, {
      allowStaging: input.staging === true,
    })
  ) {
    throw new Error(
      'La URL del QR no es válida para material. No se genera el pliego.'
    );
  }

  const layout = pharmacyFlyerLayout();
  const [backgroundDataUrl, qrDataUrl, logo] = await Promise.all([
    loadPosterBackground(layout),
    buildPosterQrDataUrl(input.publicUrl),
    loadPosterLogoAsset(input.logoUrl),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [FLYER_SHEET_PAGE_MM.widthMm, FLYER_SHEET_PAGE_MM.heightMm],
    compress: true,
  });
  doc.setProperties({
    title: posterPdfTitle({
      kind: 'pliego-flyers',
      pharmacyName: input.pharmacyName,
      staging: input.staging,
    }),
  });

  const count = input.count ?? FLYER_SHEET_DEFAULT_COUNT;
  const drawn = await drawPharmacyFlyerSheetPages(doc, {
    pharmacyName: input.pharmacyName,
    primaryColor: input.primaryColor,
    assets: { backgroundDataUrl, qrDataUrl, logo },
    count,
    staging: input.staging === true,
  });

  return {
    blob: doc.output('blob'),
    pages: drawn.pages,
    flyers: count,
    usedLogo: drawn.usedLogo,
    nameWarning: drawn.nameWarning,
  };
}
