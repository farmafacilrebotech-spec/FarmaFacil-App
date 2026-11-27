/**
 * Geometría del pliego de flyers A6 sobre A4 (sin I/O ni path aliases:
 * testeable con node --experimental-strip-types).
 *
 * Un A6 mide 105×148 mm → en un A4 (210×297) caben EXACTAMENTE 2×2 = 4.
 * Los 10 flyers del pack se reparten en ceil(10/4) = 3 páginas A4
 * (4 + 4 + 2) con los flyers a tamaño real A6 (no escalados).
 * La holgura vertical (297 − 2×148 = 1 mm) se reparte a ambos lados.
 */

import type { jsPDF } from 'jspdf';

export const FLYER_TILE_MM = { widthMm: 105, heightMm: 148 } as const;
export const FLYER_SHEET_PAGE_MM = { widthMm: 210, heightMm: 297 } as const;
export const FLYER_SHEET_COLS = 2;
export const FLYER_SHEET_ROWS = 2;
export const FLYER_SHEET_PER_PAGE = FLYER_SHEET_COLS * FLYER_SHEET_ROWS;
/** Flyers por defecto del pliego / pack de bienvenida. */
export const FLYER_SHEET_DEFAULT_COUNT = 10;

export type FlyerTilePlacement = {
  /** Índice global del flyer (0-based). */
  index: number;
  page: number;
  col: number;
  row: number;
  xMm: number;
  yMm: number;
};

export function flyerSheetPageCount(count: number): number {
  return Math.max(Math.ceil(count / FLYER_SHEET_PER_PAGE), 0);
}

/** Origen (mm) de la rejilla dentro de la página A4 (centra la holgura). */
export function flyerSheetGridOrigin(): { xMm: number; yMm: number } {
  return {
    xMm:
      (FLYER_SHEET_PAGE_MM.widthMm -
        FLYER_SHEET_COLS * FLYER_TILE_MM.widthMm) /
      2,
    yMm:
      (FLYER_SHEET_PAGE_MM.heightMm -
        FLYER_SHEET_ROWS * FLYER_TILE_MM.heightMm) /
      2,
  };
}

export function flyerSheetPlacements(count: number): FlyerTilePlacement[] {
  const o = flyerSheetGridOrigin();
  const out: FlyerTilePlacement[] = [];
  for (let i = 0; i < count; i++) {
    const page = Math.floor(i / FLYER_SHEET_PER_PAGE);
    const slot = i % FLYER_SHEET_PER_PAGE;
    const col = slot % FLYER_SHEET_COLS;
    const row = Math.floor(slot / FLYER_SHEET_COLS);
    out.push({
      index: i,
      page,
      col,
      row,
      xMm: o.xMm + col * FLYER_TILE_MM.widthMm,
      yMm: o.yMm + row * FLYER_TILE_MM.heightMm,
    });
  }
  return out;
}

/** Color y grosor de las guías de corte (hairline gris claro). */
export const FLYER_CUT_GUIDE_STYLE = {
  rgb: [190, 190, 190] as const,
  lineWidthMm: 0.1,
} as const;

/**
 * Guías de corte entre flyers de UNA página (solo donde hay flyers vecinos).
 * `tilesOnPage` = nº de flyers dibujados en esa página (1..4).
 */
export function drawFlyerCutGuides(doc: jsPDF, tilesOnPage: number): void {
  if (tilesOnPage <= 1) return;
  const o = flyerSheetGridOrigin();
  const midX = o.xMm + FLYER_TILE_MM.widthMm;
  const midY = o.yMm + FLYER_TILE_MM.heightMm;
  const [r, g, b] = FLYER_CUT_GUIDE_STYLE.rgb;
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(FLYER_CUT_GUIDE_STYLE.lineWidthMm);
  // Corte vertical central: entre columnas, en las filas ocupadas.
  const rowsUsed = tilesOnPage > FLYER_SHEET_COLS ? 2 : 1;
  doc.line(midX, o.yMm, midX, o.yMm + rowsUsed * FLYER_TILE_MM.heightMm);
  // Corte horizontal central: solo si hay segunda fila (la primera está llena).
  if (rowsUsed === 2) {
    doc.line(o.xMm, midY, o.xMm + FLYER_SHEET_COLS * FLYER_TILE_MM.widthMm, midY);
  }
}
