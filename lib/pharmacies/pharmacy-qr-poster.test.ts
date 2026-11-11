/**
 * node --experimental-strip-types --test lib/pharmacies/pharmacy-qr-poster.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { POSTER_COLORS, POSTER_COPY } from './pharmacy-qr-poster-copy.ts';

describe('POSTER_COPY', () => {
  it('incluye los textos comerciales obligatorios', () => {
    assert.equal(POSTER_COPY.headline, 'Tu farmacia, más cerca de ti');
    assert.match(POSTER_COPY.benefits, /promociones/);
    assert.match(POSTER_COPY.benefits, /pedidos/);
    assert.equal(POSTER_COPY.cta, 'ESCANEA Y DESCUBRE TU FARMACIA');
    assert.equal(POSTER_COPY.footer, 'Con la tecnología de FarmaFácil');
  });
});

describe('POSTER_COLORS', () => {
  it('usa negro y turquesa de identidad', () => {
    assert.deepEqual(POSTER_COLORS.black, { r: 11, g: 11, b: 11 });
    assert.deepEqual(POSTER_COLORS.teal, { r: 26, g: 187, b: 179 });
  });
});
