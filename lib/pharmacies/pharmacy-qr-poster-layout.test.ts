import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  POSTER_PAGE_MM,
  pharmacyQrPosterLayoutForFormat,
  posterPageFormatLabel,
  isPharmacyQrPosterTemplateReady,
  PHARMACY_QR_POSTER_LAYOUT,
} from './pharmacy-qr-poster-layout.ts';

describe('pharmacyQrPosterLayoutForFormat', () => {
  it('A4 coincide con el layout base', () => {
    const a4 = pharmacyQrPosterLayoutForFormat('a4');
    assert.equal(a4.page.widthMm, POSTER_PAGE_MM.a4.widthMm);
    assert.equal(a4.page.heightMm, POSTER_PAGE_MM.a4.heightMm);
    assert.equal(a4.backgroundSrc, PHARMACY_QR_POSTER_LAYOUT.backgroundSrc);
    assert.deepEqual(a4.qr.rect, PHARMACY_QR_POSTER_LAYOUT.qr.rect);
  });

  it('A3 conserva zonas normalizadas y escala tipografía', () => {
    const a3 = pharmacyQrPosterLayoutForFormat('a3');
    assert.equal(a3.page.widthMm, 297);
    assert.equal(a3.page.heightMm, 420);
    assert.deepEqual(a3.logo.rect, PHARMACY_QR_POSTER_LAYOUT.logo.rect);
    assert.deepEqual(a3.name.rect, PHARMACY_QR_POSTER_LAYOUT.name.rect);
    assert.ok(a3.name.maxFontSizePt > PHARMACY_QR_POSTER_LAYOUT.name.maxFontSizePt);
    assert.equal(isPharmacyQrPosterTemplateReady(a3), true);
  });

  it('A5 conserva zonas normalizadas y reduce tipografía (sin rediseño)', () => {
    const a5 = pharmacyQrPosterLayoutForFormat('a5');
    assert.equal(a5.page.widthMm, 148);
    assert.equal(a5.page.heightMm, 210);
    assert.deepEqual(a5.logo.rect, PHARMACY_QR_POSTER_LAYOUT.logo.rect);
    assert.deepEqual(a5.name.rect, PHARMACY_QR_POSTER_LAYOUT.name.rect);
    assert.deepEqual(a5.qr.rect, PHARMACY_QR_POSTER_LAYOUT.qr.rect);
    assert.ok(a5.name.maxFontSizePt < PHARMACY_QR_POSTER_LAYOUT.name.maxFontSizePt);
    assert.ok(a5.name.minFontSizePt >= 8);
    assert.equal(isPharmacyQrPosterTemplateReady(a5), true);
    // Misma proporción ISO que A4 (diferencia < 0,5 %).
    const ratioA4 = POSTER_PAGE_MM.a4.heightMm / POSTER_PAGE_MM.a4.widthMm;
    const ratioA5 = a5.page.heightMm / a5.page.widthMm;
    assert.ok(Math.abs(ratioA5 / ratioA4 - 1) < 0.005);
  });

  it('etiqueta de formato', () => {
    assert.equal(posterPageFormatLabel('a4'), 'A4');
    assert.equal(posterPageFormatLabel('a3'), 'A3');
    assert.equal(posterPageFormatLabel('a5'), 'A5');
  });
});
