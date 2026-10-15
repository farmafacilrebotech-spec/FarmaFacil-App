/**
 * npm run test:kiosk-pairing
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  kioskPharmacyRuntimeAllowed,
  resolveKioskSessionGate,
} from './commercial-gate.ts';

describe('kiosk commercial gate', () => {
  it('requires operable AND kiosk module', () => {
    assert.equal(
      kioskPharmacyRuntimeAllowed({
        pharmacyOperable: true,
        hasKioskModule: true,
      }),
      true
    );
    assert.equal(
      kioskPharmacyRuntimeAllowed({
        pharmacyOperable: false,
        hasKioskModule: true,
      }),
      false
    );
    assert.equal(
      kioskPharmacyRuntimeAllowed({
        pharmacyOperable: true,
        hasKioskModule: false,
      }),
      false
    );
  });

  it('distinguishes revoked vs commercially_blocked', () => {
    assert.equal(
      resolveKioskSessionGate({
        deviceActive: true,
        sessionRevoked: false,
        sessionExpired: false,
        pharmacyOperable: false,
        hasKioskModule: true,
      }),
      'commercially_blocked'
    );
    assert.equal(
      resolveKioskSessionGate({
        deviceActive: false,
        sessionRevoked: false,
        sessionExpired: false,
        pharmacyOperable: true,
        hasKioskModule: true,
      }),
      'revoked'
    );
    assert.equal(
      resolveKioskSessionGate({
        deviceActive: true,
        sessionRevoked: true,
        sessionExpired: false,
        pharmacyOperable: true,
        hasKioskModule: true,
      }),
      'revoked'
    );
    assert.equal(
      resolveKioskSessionGate({
        deviceActive: true,
        sessionRevoked: false,
        sessionExpired: false,
        pharmacyOperable: true,
        hasKioskModule: true,
      }),
      'valid'
    );
  });
});
