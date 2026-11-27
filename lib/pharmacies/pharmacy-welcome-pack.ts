/**
 * Pack de bienvenida: PDF multipágina con el material definitivo.
 *   1× Cartel de acceso mostrador A5 (solo QR personalizado)
 *   10× Flyer A6 → pliego A4 (2×2 por página a tamaño real; 10 flyers = 3 páginas)
 *   1× Cartel publicitario (A4 o A3 según selección)
 * Sin portada pesada. Datos siempre en vivo (nombre, logo, acceso público).
 * Sin contratos inventados.
 */

import { jsPDF } from 'jspdf';

import {
  drawPharmacyFlyerSheetPages,
  FLYER_SHEET_DEFAULT_COUNT,
} from '@/lib/pharmacies/pharmacy-flyer-sheet';
import { drawPharmacyAdPoster } from '@/lib/pharmacies/pharmacy-ad-poster';
import { isMaterialSafePharmacyPublicUrl } from '@/lib/pharmacies/print-entrypoint-url';
import {
  posterDownloadFilename,
  posterPdfTitle,
} from '@/lib/pharmacies/pharmacy-poster-meta';
import {
  buildPosterQrDataUrl,
  drawPharmacyQrPosterFromTemplate,
  downloadBlob,
  loadPosterBackground,
  loadPosterLogoAsset,
} from '@/lib/pharmacies/pharmacy-qr-poster';
import {
  pharmacyAccessCartelLayout,
  pharmacyAdPosterLayout,
  pharmacyFlyerLayout,
} from '@/lib/pharmacies/pharmacy-qr-poster-layout';

export type WelcomePackContractSlot =
  | { available: true; note?: string }
  | { available: false; reason: string };

export type WelcomePackAdFormat = 'a4' | 'a3';

export type WelcomePackInput = {
  pharmacyName: string;
  /** Producción canónica; en staging también la URL de staging (con `staging`). */
  publicUrl: string;
  publicId: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  contract?: WelcomePackContractSlot | null;
  /** Formato del cartel publicitario (default A4). */
  adFormat?: WelcomePackAdFormat;
  /** Nº de flyers A6 del pliego (default 10). */
  flyerCount?: number;
  /** Staging: QR de staging + marca de agua + sufijo PRUEBA-STAGING. */
  staging?: boolean;
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

export async function buildPharmacyWelcomePackPdf(
  input: WelcomePackInput
): Promise<WelcomePackResult> {
  const staging = input.staging === true;
  if (!isMaterialSafePharmacyPublicUrl(input.publicUrl, { allowStaging: staging })) {
    throw new Error(
      'La URL del QR no es válida para material. No se genera el pack.'
    );
  }

  const adFormat: WelcomePackAdFormat = input.adFormat === 'a3' ? 'a3' : 'a4';
  const contract = input.contract ?? defaultWelcomePackContractSlot();

  const accessLayout = pharmacyAccessCartelLayout();
  const flyerLayout = pharmacyFlyerLayout();
  const adLayout = pharmacyAdPosterLayout(adFormat);

  const [
    accessBg,
    flyerBg,
    adBg,
    qrShared,
    qrAd,
    logo,
  ] = await Promise.all([
    loadPosterBackground(accessLayout),
    loadPosterBackground(flyerLayout),
    loadPosterBackground(adLayout),
    buildPosterQrDataUrl(input.publicUrl, 1400),
    buildPosterQrDataUrl(input.publicUrl, adFormat === 'a3' ? 1600 : 1200),
    loadPosterLogoAsset(input.logoUrl),
  ]);

  // Página 1: cartel de acceso A5 (solo QR personalizado).
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [accessLayout.page.widthMm, accessLayout.page.heightMm],
    compress: true,
  });
  doc.setProperties({
    title: posterPdfTitle({
      kind: 'pack',
      pharmacyName: input.pharmacyName,
      staging,
    }),
  });

  await drawPharmacyQrPosterFromTemplate(doc, {
    pharmacyName: input.pharmacyName,
    backgroundDataUrl: accessBg,
    qrDataUrl: qrShared,
    primaryColor: input.primaryColor,
    layout: accessLayout,
    stagingWatermark: staging,
  });
  let pages = 1;

  // Pliego de flyers A6 (páginas A4).
  doc.addPage([210, 297], 'portrait');
  const sheet = await drawPharmacyFlyerSheetPages(doc, {
    pharmacyName: input.pharmacyName,
    primaryColor: input.primaryColor,
    assets: { backgroundDataUrl: flyerBg, qrDataUrl: qrShared, logo },
    count: input.flyerCount ?? FLYER_SHEET_DEFAULT_COUNT,
    staging,
  });
  pages += sheet.pages;

  // Cartel publicitario (A4 / A3).
  doc.addPage([adLayout.page.widthMm, adLayout.page.heightMm], 'portrait');
  await drawPharmacyAdPoster(doc, {
    pharmacyName: input.pharmacyName,
    qrDataUrl: qrAd,
    backgroundDataUrl: adBg,
    pharmacyLogoDataUrl: logo?.dataUrl ?? null,
    pharmacyLogoWidth: logo?.width,
    pharmacyLogoHeight: logo?.height,
    logoPreTrimmed: true,
    primaryColor: input.primaryColor,
    format: adFormat,
    layout: adLayout,
    stagingWatermark: staging,
  });
  pages += 1;

  return {
    blob: doc.output('blob'),
    filename: posterDownloadFilename({
      kind: 'pack',
      publicId: input.publicId,
      format: adFormat,
      staging,
    }),
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

/**
 * Abre una pestaña en blanco de forma SÍNCRONA (dentro del gesto del usuario).
 * Hay que llamarla ANTES de cualquier `await` (acción de servidor, generación
 * del PDF…): si no, el bloqueador de ventanas emergentes la descarta.
 */
export function reservePdfWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  try {
    const win = window.open('about:blank', '_blank');
    if (win) {
      try {
        win.document.title = 'FarmaFácil · generando cartel…';
        win.document.body.style.cssText =
          'margin:0;display:grid;place-items:center;height:100vh;font:14px system-ui;color:#555;background:#fafafa';
        win.document.body.textContent = 'Generando cartel PDF…';
      } catch {
        /* about:blank siempre es del mismo origen; ignorar si falla */
      }
    }
    return win;
  } catch {
    return null;
  }
}

/** Cierra la pestaña reservada si la generación falla. */
export function discardReservedPdfWindow(win: Window | null): void {
  try {
    if (win && !win.closed) win.close();
  } catch {
    /* noop */
  }
}

/**
 * Abre el PDF completo en una pestaña nueva (blob URL).
 * Con `reserved` navega esa pestaña; si no hay, intenta `window.open` y, como
 * último recurso, un enlace `target="_blank"`. Devuelve false si el navegador
 * bloquea todo (el llamante debe avisar al usuario).
 */
export function openPdfBlob(blob: Blob, reserved?: Window | null): boolean {
  const url = URL.createObjectURL(blob);
  // El PDF vive mientras la pestaña pueda recargarlo / «Guardar como».
  window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000);

  if (reserved && !reserved.closed) {
    try {
      reserved.location.href = url;
      return true;
    } catch {
      /* continuar con fallbacks */
    }
  }

  const win = window.open(url, '_blank');
  if (win) return true;

  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return false;
}

export function printPdfBlob(blob: Blob, reserved?: Window | null): void {
  const ok = openPdfBlob(blob, reserved);
  if (!ok) return;
  // Sin referencia a la ventana (blob en pestaña nueva): el usuario imprime
  // desde el visor PDF. Con ventana reservada intentamos print() tras cargar.
  const win = reserved && !reserved.closed ? reserved : null;
  if (!win) return;
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* impresión manual desde la pestaña */
    }
  }, 1200);
}
