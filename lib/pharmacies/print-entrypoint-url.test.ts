/**
 * node --experimental-strip-types --test lib/pharmacies/print-entrypoint-url.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isPrintSafePharmacyPublicUrl,
  pharmacyPrintPublicUrl,
} from './print-entrypoint-url.ts';

describe('pharmacyPrintPublicUrl', () => {
  it('usa siempre el dominio canónico de producción', () => {
    assert.equal(
      pharmacyPrintPublicUrl('abc12def34gh56ij'),
      'https://app.farmafacil.solutions/e/abc12def34gh56ij'
    );
  });
});

describe('isPrintSafePharmacyPublicUrl', () => {
  it('acepta canónica y rechaza localhost/staging', () => {
    assert.equal(
      isPrintSafePharmacyPublicUrl(
        'https://app.farmafacil.solutions/e/abc12def34gh56ij'
      ),
      true
    );
    assert.equal(
      isPrintSafePharmacyPublicUrl('http://127.0.0.1:3066/e/abc'),
      false
    );
    assert.equal(
      isPrintSafePharmacyPublicUrl('http://localhost:3000/e/abc'),
      false
    );
  });
});
