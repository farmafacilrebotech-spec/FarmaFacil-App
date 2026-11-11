/**
 * node --experimental-strip-types --test lib/pharmacies/tenant-nav.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isTenantNavSegmentVisible } from './pharmacy-clients-roles.ts';

describe('isTenantNavSegmentVisible', () => {
  it('propietario ve clientes y QR', () => {
    assert.equal(isTenantNavSegmentVisible('clientes', 'PHARMACY_OWNER'), true);
    assert.equal(isTenantNavSegmentVisible('qr', 'PHARMACY_OWNER'), true);
  });

  it('farmacéutico ve clientes pero no QR', () => {
    assert.equal(isTenantNavSegmentVisible('clientes', 'PHARMACIST'), true);
    assert.equal(isTenantNavSegmentVisible('qr', 'PHARMACIST'), false);
  });

  it('empleado no ve clientes ni QR', () => {
    assert.equal(isTenantNavSegmentVisible('clientes', 'STAFF'), false);
    assert.equal(isTenantNavSegmentVisible('qr', 'STAFF'), false);
  });

  it('segmentos sin gate siguen visibles', () => {
    assert.equal(isTenantNavSegmentVisible('pedidos', 'STAFF'), true);
  });
});
