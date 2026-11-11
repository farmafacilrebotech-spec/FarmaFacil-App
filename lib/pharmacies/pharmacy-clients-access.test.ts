/**
 * node --experimental-strip-types --test lib/pharmacies/pharmacy-clients-access.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  roleCanManagePharmacyQr,
  roleCanViewPharmacyClients,
} from './pharmacy-clients-roles.ts';

describe('pharmacy clients / QR role gates', () => {
  it('clientes: owner, admin y farmacéutico; no empleado', () => {
    assert.equal(roleCanViewPharmacyClients('PHARMACY_OWNER'), true);
    assert.equal(roleCanViewPharmacyClients('PHARMACY_ADMIN'), true);
    assert.equal(roleCanViewPharmacyClients('PHARMACIST'), true);
    assert.equal(roleCanViewPharmacyClients('STAFF'), false);
  });

  it('QR: solo owner y admin', () => {
    assert.equal(roleCanManagePharmacyQr('PHARMACY_OWNER'), true);
    assert.equal(roleCanManagePharmacyQr('PHARMACY_ADMIN'), true);
    assert.equal(roleCanManagePharmacyQr('PHARMACIST'), false);
    assert.equal(roleCanManagePharmacyQr('STAFF'), false);
  });
});
