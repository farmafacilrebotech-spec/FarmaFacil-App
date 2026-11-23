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

  it('farmacéutico ve clientes pero no QR ni usuarios ni kiosko', () => {
    assert.equal(isTenantNavSegmentVisible('clientes', 'PHARMACIST'), true);
    assert.equal(isTenantNavSegmentVisible('qr', 'PHARMACIST'), false);
    assert.equal(isTenantNavSegmentVisible('usuarios', 'PHARMACIST'), false);
    assert.equal(isTenantNavSegmentVisible('dispositivos', 'PHARMACIST'), false);
  });

  it('empleado no ve clientes ni QR ni usuarios ni kiosko', () => {
    assert.equal(isTenantNavSegmentVisible('clientes', 'STAFF'), false);
    assert.equal(isTenantNavSegmentVisible('qr', 'STAFF'), false);
    assert.equal(isTenantNavSegmentVisible('usuarios', 'STAFF'), false);
    assert.equal(isTenantNavSegmentVisible('dispositivos', 'STAFF'), false);
  });

  it('propietario ve usuarios y kiosko', () => {
    assert.equal(isTenantNavSegmentVisible('usuarios', 'PHARMACY_OWNER'), true);
    assert.equal(isTenantNavSegmentVisible('dispositivos', 'PHARMACY_OWNER'), true);
  });

  it('segmentos sin gate siguen visibles', () => {
    assert.equal(isTenantNavSegmentVisible('pedidos', 'STAFF'), true);
  });
});
