import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  kioskSessionFailureRedirectPath,
  mapValidateDeviceSessionRpc,
} from './device-session-map.ts';
import {
  encodeKioskSessionCookie,
  parseKioskSessionCookie,
} from './session-cookie-parse.ts';

describe('mapValidateDeviceSessionRpc', () => {
  it('sin cookie → missing', () => {
    const r = mapValidateDeviceSessionRpc({ cookieMissing: true });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'missing');
  });

  it('error RPC → invalid (no asume revoked)', () => {
    const r = mapValidateDeviceSessionRpc({ rpcError: true });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'invalid');
  });

  it('status valid → sesión usable', () => {
    const r = mapValidateDeviceSessionRpc({
      data: {
        status: 'valid',
        pharmacy_id: '11111111-1111-1111-1111-111111111111',
        device_id: '22222222-2222-2222-2222-222222222222',
        session_id: '33333333-3333-3333-3333-333333333333',
        display_name: 'KIOSKO',
      },
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.session.displayName, 'KIOSKO');
      assert.equal(r.session.pharmacyId, '11111111-1111-1111-1111-111111111111');
      assert.equal(r.session.deviceId, '22222222-2222-2222-2222-222222222222');
      assert.equal(r.session.sessionId, '33333333-3333-3333-3333-333333333333');
    }
  });

  it('status revoked → revoked (incluye caducada en RPC 036)', () => {
    const r = mapValidateDeviceSessionRpc({
      data: { status: 'revoked' },
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'revoked');
  });

  it('status commercially_blocked → commercially_blocked', () => {
    const r = mapValidateDeviceSessionRpc({
      data: { status: 'commercially_blocked' },
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'commercially_blocked');
  });

  it('payload vacío / status desconocido → invalid', () => {
    assert.equal(mapValidateDeviceSessionRpc({ data: null }).ok, false);
    const r = mapValidateDeviceSessionRpc({ data: { status: 'weird' } });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'invalid');
  });
});

describe('kioskSessionFailureRedirectPath', () => {
  it('revoked y commercial → /k (UI controlada)', () => {
    assert.equal(kioskSessionFailureRedirectPath('revoked'), '/k');
    assert.equal(kioskSessionFailureRedirectPath('commercially_blocked'), '/k');
  });

  it('missing e invalid → /k/pair', () => {
    assert.equal(kioskSessionFailureRedirectPath('missing'), '/k/pair');
    assert.equal(kioskSessionFailureRedirectPath('invalid'), '/k/pair');
  });
});

describe('cookie parse + substitute semantics (pair)', () => {
  const sidOld = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const sidNew = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const credOld = 'old-credential-value-16';
  const credNew = 'new-credential-value-16';

  it('cookie ausente → null (acceso sin cookie)', () => {
    assert.equal(parseKioskSessionCookie(undefined), null);
    assert.equal(parseKioskSessionCookie(''), null);
    assert.equal(parseKioskSessionCookie('invalid'), null);
  });

  it('cookie antigua parseable sigue parseable hasta sustituir', () => {
    const raw = encodeKioskSessionCookie(sidOld, credOld);
    const parsed = parseKioskSessionCookie(raw);
    assert.ok(parsed);
    assert.equal(parsed!.sessionId, sidOld);
    assert.equal(parsed!.credential, credOld);
  });

  it('emparejamiento sustituye cookie (nuevo encode pisa el anterior)', () => {
    const previous = encodeKioskSessionCookie(sidOld, credOld);
    const next = encodeKioskSessionCookie(sidNew, credNew);
    assert.notEqual(previous, next);
    const parsed = parseKioskSessionCookie(next);
    assert.ok(parsed);
    assert.equal(parsed!.sessionId, sidNew);
    assert.equal(parsed!.credential, credNew);
    // La cookie antigua ya no es la vigente tras setKioskSessionCookie en pair.
    assert.equal(parseKioskSessionCookie(previous)?.sessionId, sidOld);
  });
});
