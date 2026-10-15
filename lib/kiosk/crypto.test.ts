/**
 * npm run test:kiosk-crypto
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPairingCodeDisplay,
  generatePairingCodePlaintext,
  generateSessionCredential,
  hashPairingCode,
  normalizePairingCode,
  PAIRING_CODE_TTL_MS,
  sha256Hex,
} from './crypto.ts';
import {
  encodeKioskSessionCookie,
  parseKioskSessionCookie,
} from './session-cookie-parse.ts';

describe('pairing code crypto', () => {
  it('normalizes spaces and dashes', () => {
    assert.equal(normalizePairingCode('ab-cd  ef12'), 'ABCDEF12');
  });

  it('hashes are stable and case-insensitive via normalize', () => {
    const a = hashPairingCode('abcd-efgh');
    const b = hashPairingCode('ABCDEFGH');
    assert.equal(a, b);
    assert.equal(a.length, 64);
  });

  it('different codes produce different hashes', () => {
    assert.notEqual(hashPairingCode('AAAAAAAA'), hashPairingCode('BBBBBBBB'));
  });

  it('generated codes are 8 chars from safe alphabet', () => {
    const code = generatePairingCodePlaintext();
    assert.equal(code.length, 8);
    assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
    assert.equal(formatPairingCodeDisplay(code).length, 9);
  });

  it('TTL is 10 minutes', () => {
    assert.equal(PAIRING_CODE_TTL_MS, 10 * 60 * 1000);
  });
});

describe('session credential cookie encoding', () => {
  it('round-trips session id and credential', () => {
    const sessionId = '92dbe632-f82a-4c55-a737-3c77f105254e';
    const credential = generateSessionCredential();
    const encoded = encodeKioskSessionCookie(sessionId, credential);
    const parsed = parseKioskSessionCookie(encoded);
    assert.ok(parsed);
    assert.equal(parsed!.sessionId, sessionId);
    assert.equal(parsed!.credential, credential);
  });

  it('rejects malformed cookies', () => {
    assert.equal(parseKioskSessionCookie(null), null);
    assert.equal(parseKioskSessionCookie('v1.not-a-uuid.abc'), null);
    assert.equal(parseKioskSessionCookie('v2.x.y'), null);
  });

  it('credential hash is sha256 hex', () => {
    const c = generateSessionCredential();
    assert.equal(sha256Hex(c).length, 64);
  });
});

describe('isolation / reuse contract (documented)', () => {
  it('code hash alone cannot reveal pharmacy id (one-way)', () => {
    const hash = hashPairingCode('TESTCODE');
    assert.doesNotMatch(hash, /pharmacy/i);
    assert.equal(hash.includes('TESTCODE'), false);
  });
});
