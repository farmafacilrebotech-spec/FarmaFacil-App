import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  kioskDeviceCommercialServiceLabel,
  kioskDeviceTechnicalLabel,
  resolveKioskDeviceCommercialService,
} from './device-status-display.ts';
import { kioskModuleCurrentlyUsable } from './entitlement-status.ts';

const NOW = Date.parse('2026-10-15T12:00:00.000Z');

describe('kiosk device status display', () => {
  it('labels technical status as Vinculado / Revocado (not Activo operativo)', () => {
    assert.equal(kioskDeviceTechnicalLabel('active'), 'Vinculado');
    assert.equal(kioskDeviceTechnicalLabel('revoked'), 'Revocado');
  });

  it('shows Bloqueado por suscripción when linked but module not usable', () => {
    assert.equal(
      resolveKioskDeviceCommercialService({
        deviceStatus: 'active',
        moduleUsable: false,
      }),
      'blocked_by_subscription'
    );
    assert.equal(
      kioskDeviceCommercialServiceLabel('blocked_by_subscription'),
      'Bloqueado por suscripción'
    );
  });

  it('shows Servicio habilitado when linked and module usable', () => {
    assert.equal(
      resolveKioskDeviceCommercialService({
        deviceStatus: 'active',
        moduleUsable: true,
      }),
      'enabled'
    );
  });

  it('does not invent commercial service for revoked devices', () => {
    assert.equal(
      resolveKioskDeviceCommercialService({
        deviceStatus: 'revoked',
        moduleUsable: true,
      }),
      'not_applicable'
    );
  });

  it('cancelled entitlement → module not usable → blocked for linked device', () => {
    const usable = kioskModuleCurrentlyUsable(
      { status: 'cancelled', source: 'plan', endsAt: null },
      NOW
    );
    assert.equal(usable, false);
    assert.equal(
      resolveKioskDeviceCommercialService({
        deviceStatus: 'active',
        moduleUsable: usable,
      }),
      'blocked_by_subscription'
    );
  });
});
