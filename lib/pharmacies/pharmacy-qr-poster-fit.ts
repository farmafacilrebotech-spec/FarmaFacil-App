/**
 * Ajuste tipográfico del nombre en la zona del cartel (sin I/O).
 * Testeable con node --experimental-strip-types (sin imports de layout).
 */

import type { jsPDF } from 'jspdf';

export type PosterRectMm = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type NameZoneFitConfig = {
  maxFontSizePt: number;
  minFontSizePt: number;
  maxLines: 1 | 2;
  fontStyle: 'normal' | 'bold';
  /** Familia jsPDF (p. ej. SourceSans3). Default helvetica. */
  fontFamily?: string;
  /** Si true, mide/ajusta en MAYÚSCULAS (solo visual). */
  uppercase?: boolean;
};

export type NameFitResult = {
  ok: boolean;
  fontSizePt: number;
  lines: string[];
  warning: string | null;
};

type TextMeasurer = {
  setFont: (name: string, style: string) => void;
  setFontSize: (size: number) => void;
  splitTextToSize: (text: string, maxlen: number) => string[];
};

export const PHARMACY_QR_POSTER_NAME_OVERFLOW_MESSAGE =
  'El nombre de la farmacia es demasiado largo para el cartel con el tamaño mínimo legible.';

/** pt → mm aproximado (1 pt = 25.4/72 mm). */
export function ptToMm(pt: number): number {
  return (pt * 25.4) / 72;
}

export function fitPharmacyNameInZone(
  doc: TextMeasurer | jsPDF,
  pharmacyName: string,
  zoneMm: PosterRectMm,
  nameZone: NameZoneFitConfig
): NameFitResult {
  const raw = pharmacyName.trim() || 'Farmacia';
  const text = nameZone.uppercase
    ? raw.toLocaleUpperCase('es-ES')
    : raw;
  const maxLines = nameZone.maxLines;
  const minPt = nameZone.minFontSizePt;
  const maxPt = Math.max(nameZone.maxFontSizePt, minPt);
  const family = nameZone.fontFamily?.trim() || 'helvetica';

  doc.setFont(family, nameZone.fontStyle);

  for (let fontSizePt = maxPt; fontSizePt >= minPt; fontSizePt -= 0.5) {
    doc.setFontSize(fontSizePt);
    const lines = doc.splitTextToSize(text, Math.max(zoneMm.w, 1));
    if (lines.length > maxLines) continue;
    const lineH = ptToMm(fontSizePt) * 1.15;
    const blockH = lines.length * lineH;
    if (blockH <= zoneMm.h + 0.01) {
      return { ok: true, fontSizePt, lines, warning: null };
    }
  }

  doc.setFontSize(minPt);
  const lines = doc.splitTextToSize(text, Math.max(zoneMm.w, 1));
  const lineH = ptToMm(minPt) * 1.15;
  const clipped = lines.slice(0, maxLines);
  const blockH = clipped.length * lineH;
  const overflows = lines.length > maxLines || blockH > zoneMm.h + 0.01;

  return {
    ok: !overflows,
    fontSizePt: minPt,
    lines: clipped,
    warning: overflows ? PHARMACY_QR_POSTER_NAME_OVERFLOW_MESSAGE : null,
  };
}
