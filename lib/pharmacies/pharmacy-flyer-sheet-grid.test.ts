import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { jsPDF } from 'jspdf';

import {
  drawFlyerCutGuides,
  FLYER_CUT_GUIDE_STYLE,
  FLYER_SHEET_DEFAULT_COUNT,
  FLYER_SHEET_PAGE_MM,
  FLYER_TILE_MM,
  flyerSheetGridOrigin,
  flyerSheetPageCount,
  flyerSheetPlacements,
} from './pharmacy-flyer-sheet-grid.ts';

describe('pliego de flyers A6 sobre A4', () => {
  it('página A4 y tiles A6 exactos', () => {
    assert.deepEqual(FLYER_SHEET_PAGE_MM, { widthMm: 210, heightMm: 297 });
    assert.deepEqual(FLYER_TILE_MM, { widthMm: 105, heightMm: 148 });
  });

  it('2×2 tiles A6 llenan A4 (ancho exacto, holgura vertical ≤ 1 mm)', () => {
    const o = flyerSheetGridOrigin();
    assert.equal(o.xMm, 0);
    assert.ok(o.yMm >= 0 && o.yMm <= 0.5 + 1e-9);
    const p = flyerSheetPlacements(4);
    for (const t of p) {
      assert.ok(t.xMm + FLYER_TILE_MM.widthMm <= 210 + 1e-9);
      assert.ok(t.yMm + FLYER_TILE_MM.heightMm <= 297 + 1e-9);
    }
    assert.equal(p[1]!.xMm - p[0]!.xMm, 105);
    assert.equal(p[2]!.yMm - p[0]!.yMm, 148);
  });

  it('10 flyers = 3 páginas A4 (4+4+2)', () => {
    assert.equal(FLYER_SHEET_DEFAULT_COUNT, 10);
    assert.equal(flyerSheetPageCount(10), 3);
    const p = flyerSheetPlacements(10);
    assert.equal(p.length, 10);
    const perPage = [0, 1, 2].map((n) => p.filter((t) => t.page === n).length);
    assert.deepEqual(perPage, [4, 4, 2]);
  });

  it('los tiles no se solapan', () => {
    const p = flyerSheetPlacements(10).filter((t) => t.page === 0);
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        const a = p[i]!;
        const b = p[j]!;
        const overlap =
          a.xMm < b.xMm + 105 - 1e-9 &&
          b.xMm < a.xMm + 105 - 1e-9 &&
          a.yMm < b.yMm + 148 - 1e-9 &&
          b.yMm < a.yMm + 148 - 1e-9;
        assert.equal(overlap, false);
      }
    }
  });

  it('el PDF del pliego tiene páginas de 210×297 mm', () => {
    const doc = new jsPDF({ unit: 'mm', format: [210, 297] });
    drawFlyerCutGuides(doc, 4);
    doc.addPage([210, 297], 'portrait');
    drawFlyerCutGuides(doc, 2);
    assert.equal(doc.getNumberOfPages(), 2);
    const size = doc.internal.pageSize;
    assert.ok(Math.abs(size.getWidth() - 210) < 1e-6);
    assert.ok(Math.abs(size.getHeight() - 297) < 1e-6);
  });

  it('guías hairline gris claro: 2 líneas con 4 flyers, 1 con 2, 0 con 1', () => {
    const count = (n: number) => {
      const doc = new jsPDF({ unit: 'mm', format: [210, 297], compress: false });
      drawFlyerCutGuides(doc, n);
      const pdf = doc.output();
      return (pdf.match(/ l\n/g) ?? []).length;
    };
    assert.equal(count(4), 2);
    assert.equal(count(3), 2);
    assert.equal(count(2), 1);
    assert.equal(count(1), 0);
    assert.ok(FLYER_CUT_GUIDE_STYLE.lineWidthMm <= 0.15);
    assert.ok(FLYER_CUT_GUIDE_STYLE.rgb.every((c) => c >= 170));
  });
});
