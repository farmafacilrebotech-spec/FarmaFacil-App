import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AD_POSTER_BRAND,
  AD_POSTER_COPY,
  adPosterScale,
} from './pharmacy-ad-poster-brand.ts';
import { pharmacyAdPosterLayout } from './pharmacy-qr-poster-layout.ts';

describe('pharmacy-ad-poster', () => {
  it('identidad corporativa de campaña', () => {
    assert.equal(AD_POSTER_BRAND.black, '#0B0B0B');
    assert.equal(AD_POSTER_BRAND.turquoise, '#1ABBB3');
    assert.equal(AD_POSTER_BRAND.white, '#F7F9FA');
    assert.equal(AD_POSTER_BRAND.silver, '#C5CCD3');
    assert.match(AD_POSTER_COPY.headline, /bolsillo/);
    assert.equal(AD_POSTER_COPY.pillars, 'Consulta · Pide · Recoge');
    assert.match(AD_POSTER_COPY.cta, /Descúbrelo/);
  });

  it('escala A3 ≈ √2', () => {
    assert.equal(adPosterScale('a4'), 1);
    assert.ok(Math.abs(adPosterScale('a3') - Math.SQRT2) < 1e-9);
  });

  it('escala A5 = 148/210 y la composición A4 escalada cabe en 210 mm', () => {
    const s = adPosterScale('a5');
    assert.ok(Math.abs(s - 148 / 210) < 1e-9);
    assert.ok(297 * s <= 210 + 1e-9);
  });

  it('el cartel usa el arte corporativo (no composición programática)', () => {
    const l = pharmacyAdPosterLayout('a4');
    assert.equal(l.backgroundSrc, '/images/posters/cartel-publicitario-a3-print.jpg');
    assert.ok((l.placeholderCovers?.length ?? 0) >= 2);
    // Cada zona de logo/nombre/QR cabe en la página.
    for (const r of [l.logo.rect, l.name.rect, l.qr.rect]) {
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1 && r.y + r.h <= 1);
    }
  });
});
