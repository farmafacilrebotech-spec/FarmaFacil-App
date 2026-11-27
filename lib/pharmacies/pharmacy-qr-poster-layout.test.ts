import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  POSTER_PAGE_MM,
  pharmacyQrPosterLayoutForFormat,
  posterPageFormatLabel,
  isPharmacyQrPosterTemplateReady,
  rectNormToMm,
  qrInnerRectMm,
  PHARMACY_QR_POSTER_LAYOUT,
  pharmacyAccessCartelLayout,
  pharmacyAdPosterLayout,
  pharmacyFlyerLayout,
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
    assert.equal(posterPageFormatLabel('a6'), 'A6');
  });
});

describe('formato A6', () => {
  it('POSTER_PAGE_MM.a6 = 105×148 y es la mitad de A5/A4 en ancho', () => {
    assert.deepEqual(POSTER_PAGE_MM.a6, { widthMm: 105, heightMm: 148 });
    // 2×2 A6 llenan A4 (con 1 mm de holgura vertical).
    assert.equal(POSTER_PAGE_MM.a6.widthMm * 2, POSTER_PAGE_MM.a4.widthMm);
    assert.ok(POSTER_PAGE_MM.a4.heightMm - POSTER_PAGE_MM.a6.heightMm * 2 <= 1);
  });

  it('pharmacyQrPosterLayoutForFormat("a6") redirige al flyer', () => {
    const a6 = pharmacyQrPosterLayoutForFormat('a6');
    assert.equal(a6.page.widthMm, 105);
    assert.equal(a6.backgroundSrc, '/images/posters/flyer-acceso-qr-a6-print.jpg');
    assert.ok(a6.name.maxFontSizePt < PHARMACY_QR_POSTER_LAYOUT.name.maxFontSizePt);
    assert.ok(a6.name.minFontSizePt >= 7);
  });
});

describe('pharmacyFlyerLayout', () => {
  it('A6 con arte flyer y zonas completas logo+nombre+QR (HD 4419×6250)', () => {
    const l = pharmacyFlyerLayout();
    assert.deepEqual(l.page, { widthMm: 105, heightMm: 148 });
    assert.equal(l.backgroundSrc, '/images/posters/flyer-acceso-qr-a6-print.jpg');
    assert.deepEqual(l.templatePx, { width: 4419, height: 6250 });
    assert.equal(l.logo.configured, true);
    assert.equal(l.name.configured, true);
    assert.equal(l.qr.configured, true);
    assert.deepEqual(l.qr.rect, PHARMACY_QR_POSTER_LAYOUT.qr.rect);
    assert.equal(isPharmacyQrPosterTemplateReady(l), true);
  });
});

describe('pharmacyAccessCartelLayout (A5, solo QR)', () => {
  const l = pharmacyAccessCartelLayout();

  it('A5 148×210 con arte cartel-acceso-qr-a5-print.jpg', () => {
    assert.deepEqual(l.page, { widthMm: 148, heightMm: 210 });
    assert.equal(l.backgroundSrc, '/images/posters/cartel-acceso-qr-a5-print.jpg');
    assert.deepEqual(l.templatePx, { width: 1747, height: 2481 });
  });

  it('solo QR configurado; sin hueco de logo ni nombre', () => {
    assert.equal(l.logo.configured, false);
    assert.equal(l.name.configured, false);
    assert.equal(l.qr.configured, true);
    assert.deepEqual(l.qr.rect, { x: 0.3543, y: 0.4095, w: 0.2942, h: 0.2023 });
    assert.equal(l.qr.quietZoneRatio, 0.04);
  });

  it('la plantilla QR-only se considera lista', () => {
    assert.equal(isPharmacyQrPosterTemplateReady(l), true);
  });

  it('QR dentro de la página y legible (≥ 25 mm)', () => {
    const mm = rectNormToMm(l.qr.rect, l.page);
    assert.ok(mm.x >= 0 && mm.x + mm.w <= l.page.widthMm);
    assert.ok(mm.y >= 0 && mm.y + mm.h <= l.page.heightMm);
    const inner = qrInnerRectMm(mm, l.qr.quietZoneRatio);
    assert.ok(inner.w >= 25, `QR ${inner.w} mm`);
  });
});

describe('isPharmacyQrPosterTemplateReady', () => {
  it('exige QR; logo/nombre solo si configured=true', () => {
    const base = pharmacyAccessCartelLayout();
    assert.equal(isPharmacyQrPosterTemplateReady(base), true);
    assert.equal(
      isPharmacyQrPosterTemplateReady({ ...base, qr: { ...base.qr, configured: false } }),
      false
    );
    assert.equal(
      isPharmacyQrPosterTemplateReady({ ...base, backgroundSrc: null }),
      false
    );
    // logo declarado pero con rect vacío → no lista
    assert.equal(
      isPharmacyQrPosterTemplateReady({ ...base, logo: { ...base.logo, configured: true } }),
      false
    );
  });
});

describe('pharmacyAdPosterLayout', () => {
  it('A3 nativo y A4 comparten zonas normalizadas', () => {
    const a3 = pharmacyAdPosterLayout('a3');
    const a4 = pharmacyAdPosterLayout('a4');
    assert.deepEqual(a3.page, { widthMm: 297, heightMm: 420 });
    assert.deepEqual(a4.page, { widthMm: 210, heightMm: 297 });
    assert.equal(a3.backgroundSrc, '/images/posters/cartel-publicitario-a3-print.jpg');
    assert.deepEqual(a3.templatePx, { width: 3508, height: 4961 });
    assert.deepEqual(a4.logo.rect, a3.logo.rect);
    assert.deepEqual(a4.name.rect, a3.name.rect);
    assert.deepEqual(a4.qr.rect, a3.qr.rect);
    assert.ok(a4.name.maxFontSizePt < a3.name.maxFontSizePt);
    assert.equal(isPharmacyQrPosterTemplateReady(a3), true);
    assert.equal(isPharmacyQrPosterTemplateReady(a4), true);
  });

  it('zonas medidas', () => {
    const l = pharmacyAdPosterLayout('a3');
    assert.deepEqual(l.logo.rect, { x: 0.0468, y: 0.0208, w: 0.2195, h: 0.0861 });
    assert.equal(l.logo.insetRatio, 0.06);
    assert.deepEqual(l.name.rect, { x: 0.3196, y: 0.0202, w: 0.6804, h: 0.0998 });
    assert.equal(l.name.insetRatio, 0.05);
    assert.equal(l.name.maxLines, 2);
    assert.equal(l.name.fontStyle, 'bold');
    assert.ok(l.name.align === 'left' || l.name.align === 'center');
    assert.deepEqual(l.qr.rect, { x: 0.039, y: 0.76, w: 0.217, h: 0.153 });
    assert.equal(l.qr.quietZoneRatio, 0.06);
  });

  it('tapas opacas cubren los placeholders grises (logo y nombre)', () => {
    const l = pharmacyAdPosterLayout('a3');
    assert.equal(l.placeholderCovers?.length, 2);
    // Cajas grises medidas sobre el arte (normalizado).
    const grays = [
      { x: 0.0473, y: 0.021, r: 0.266, b: 0.1085 },
      { x: 0.3198, y: 0.0201, r: 0.94, b: 0.1085 },
    ];
    grays.forEach((g, i) => {
      const c = l.placeholderCovers![i]!;
      assert.ok(c.rect.x <= g.x && c.rect.y <= g.y, `cover ${i} origen`);
      assert.ok(c.rect.x + c.rect.w >= g.r && c.rect.y + c.rect.h >= g.b, `cover ${i} fin`);
      assert.match(c.color, /^#D[0-9A-F]D[0-9A-F]D[0-9A-F]$/i);
    });
  });

  it('el texto del nombre queda dentro de la caja gris tapada', () => {
    const l = pharmacyAdPosterLayout('a3');
    const vis = l.name.visibleRect!;
    const cover = l.placeholderCovers![1]!.rect;
    assert.ok(vis.x >= cover.x - 1e-9 && vis.x + vis.w <= cover.x + cover.w + 1e-9);
    assert.ok(vis.y >= cover.y - 1e-9 && vis.y + vis.h <= cover.y + cover.h + 1e-9);
  });
});
