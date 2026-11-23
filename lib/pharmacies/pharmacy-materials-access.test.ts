import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PHARMACY_TENANT_MATERIALS_CONTACT_MESSAGE,
  canGeneratePharmacyMaterials,
} from './pharmacy-materials-access.ts';

describe('canGeneratePharmacyMaterials', () => {
  it('solo SuperAdmin genera material publicitario', () => {
    assert.equal(canGeneratePharmacyMaterials(true), true);
    assert.equal(canGeneratePharmacyMaterials(false), false);
  });

  it('mensaje tenant remite a FarmaFácil', () => {
    assert.match(PHARMACY_TENANT_MATERIALS_CONTACT_MESSAGE, /contacta con FarmaFácil/);
  });
});
