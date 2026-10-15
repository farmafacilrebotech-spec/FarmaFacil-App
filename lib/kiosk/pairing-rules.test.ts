/**
 * npm run test:kiosk-pairing
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  attemptConsumePairingCode,
  deviceBelongsToPharmacy,
  sessionValidAfterRevoke,
  simulateReuseAfterConsume,
} from './pairing-rules.ts';
import { hashPairingCode } from './crypto.ts';

const PHARMACY_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PHARMACY_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('pairing code consume / expiry / reuse', () => {
  const now = new Date('2026-10-15T10:00:00.000Z');
  const hash = hashPairingCode('ABCD1234');

  it('accepts fresh unconsumed code', () => {
    const result = attemptConsumePairingCode({
      submittedHash: hash,
      row: {
        pharmacyId: PHARMACY_A,
        codeHash: hash,
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        consumedAt: null,
      },
      now,
    });
    assert.deepEqual(result, { ok: true, pharmacyId: PHARMACY_A });
  });

  it('rejects expired code', () => {
    const result = attemptConsumePairingCode({
      submittedHash: hash,
      row: {
        pharmacyId: PHARMACY_A,
        codeHash: hash,
        expiresAt: new Date(now.getTime() - 1000),
        consumedAt: null,
      },
      now,
    });
    assert.equal(result.ok, false);
  });

  it('rejects reuse after consume (one-shot)', () => {
    const row = {
      pharmacyId: PHARMACY_A,
      codeHash: hash,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      consumedAt: null,
    };
    const first = attemptConsumePairingCode({
      submittedHash: hash,
      row,
      now,
    });
    assert.equal(first.ok, true);
    const second = simulateReuseAfterConsume(row, hash, now);
    assert.equal(second.ok, false);
  });

  it('unknown hash → unavailable', () => {
    const result = attemptConsumePairingCode({
      submittedHash: hash,
      row: null,
      now,
    });
    assert.equal(result.ok, false);
  });

  it('rejects when pharmacy not operable or without kiosk module (same reason)', () => {
    const row = {
      pharmacyId: PHARMACY_A,
      codeHash: hash,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      consumedAt: null,
    };
    const notOperable = attemptConsumePairingCode({
      submittedHash: hash,
      row,
      now,
      pharmacyOperable: false,
      hasKioskModule: true,
    });
    const noModule = attemptConsumePairingCode({
      submittedHash: hash,
      row,
      now,
      pharmacyOperable: true,
      hasKioskModule: false,
    });
    assert.deepEqual(notOperable, { ok: false, reason: 'unavailable' });
    assert.deepEqual(noModule, { ok: false, reason: 'unavailable' });
  });
});

describe('pharmacy isolation', () => {
  it('device of A is not managed as B', () => {
    assert.equal(
      deviceBelongsToPharmacy({
        devicePharmacyId: PHARMACY_A,
        requestedPharmacyId: PHARMACY_B,
      }),
      false
    );
    assert.equal(
      deviceBelongsToPharmacy({
        devicePharmacyId: PHARMACY_A,
        requestedPharmacyId: PHARMACY_A,
      }),
      true
    );
  });
});

describe('revocation', () => {
  it('revoked device or session is not valid', () => {
    assert.equal(
      sessionValidAfterRevoke({
        deviceStatus: 'revoked',
        sessionRevokedAt: null,
      }),
      false
    );
    assert.equal(
      sessionValidAfterRevoke({
        deviceStatus: 'active',
        sessionRevokedAt: new Date(),
      }),
      false
    );
    assert.equal(
      sessionValidAfterRevoke({
        deviceStatus: 'active',
        sessionRevokedAt: null,
      }),
      true
    );
  });
});
