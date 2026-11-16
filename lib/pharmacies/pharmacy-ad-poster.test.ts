import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AD_POSTER_BRAND,
  AD_POSTER_COPY,
  adPosterScale,
} from './pharmacy-ad-poster-brand.ts';

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
});
