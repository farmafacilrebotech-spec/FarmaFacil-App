/**
 * npm run test:kiosk-pairing
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAIRING_GENERIC_FAILURE_MESSAGE,
  PAIRING_RATE_MAX_ATTEMPTS,
  pairingRateCheck,
  pairingRateFail,
} from './pairing-rate-limit.ts';

describe('pairing rate limit', () => {
  const t0 = Date.parse('2026-10-15T10:00:00.000Z');

  it('allows first attempts within window', () => {
    let bucket = pairingRateCheck(null, t0).bucket;
    for (let i = 0; i < PAIRING_RATE_MAX_ATTEMPTS - 1; i++) {
      const check = pairingRateCheck(bucket, t0 + i * 1000);
      assert.equal(check.allowed, true);
      bucket = pairingRateFail(check.bucket, t0 + i * 1000);
    }
    assert.equal(bucket.attemptCount, PAIRING_RATE_MAX_ATTEMPTS - 1);
    assert.equal(bucket.blockedUntil, null);
  });

  it('blocks after max failed attempts', () => {
    let bucket = pairingRateCheck(null, t0).bucket;
    for (let i = 0; i < PAIRING_RATE_MAX_ATTEMPTS; i++) {
      const check = pairingRateCheck(bucket, t0);
      assert.equal(check.allowed, true);
      bucket = pairingRateFail(check.bucket, t0);
    }
    assert.ok(bucket.blockedUntil != null);
    const blocked = pairingRateCheck(bucket, t0 + 60_000);
    assert.equal(blocked.allowed, false);
  });

  it('resets after window elapses', () => {
    let bucket = pairingRateCheck(null, t0).bucket;
    bucket = pairingRateFail(bucket, t0);
    const later = t0 + 16 * 60 * 1000;
    const check = pairingRateCheck(bucket, later);
    assert.equal(check.allowed, true);
    assert.equal(check.bucket.attemptCount, 0);
  });

  it('client failure message does not enumerate codes or pharmacies', () => {
    assert.match(PAIRING_GENERIC_FAILURE_MESSAGE, /Código no válido/);
    assert.doesNotMatch(PAIRING_GENERIC_FAILURE_MESSAGE, /rate/i);
    assert.doesNotMatch(PAIRING_GENERIC_FAILURE_MESSAGE, /bloquead/i);
    assert.doesNotMatch(PAIRING_GENERIC_FAILURE_MESSAGE, /módulo/i);
    assert.doesNotMatch(PAIRING_GENERIC_FAILURE_MESSAGE, /[0-9a-f]{8}-[0-9a-f]{4}/i);
  });
});
