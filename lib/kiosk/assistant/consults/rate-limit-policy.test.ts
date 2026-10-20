import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CONSULT_RATE_LIMITS,
  evaluateConsultCreateRateLimit,
  rateLimitUserMessage,
} from './rate-limit-policy.ts';

describe('evaluateConsultCreateRateLimit', () => {
  it('permite bajo los límites', () => {
    assert.deepEqual(
      evaluateConsultCreateRateLimit({
        countTurn: 0,
        countDeviceHour: 0,
        countPharmacyHour: 0,
      }),
      { ok: true }
    );
  });

  it('bloquea por turno antes que por dispositivo', () => {
    const r = evaluateConsultCreateRateLimit({
      countTurn: CONSULT_RATE_LIMITS.maxPerTurn,
      countDeviceHour: 0,
      countPharmacyHour: 0,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.scope, 'turn');
  });

  it('bloquea por dispositivo y farmacia', () => {
    const d = evaluateConsultCreateRateLimit({
      countTurn: 0,
      countDeviceHour: CONSULT_RATE_LIMITS.maxPerDeviceHour,
      countPharmacyHour: 0,
    });
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.scope, 'device');

    const p = evaluateConsultCreateRateLimit({
      countTurn: 0,
      countDeviceHour: 0,
      countPharmacyHour: CONSULT_RATE_LIMITS.maxPerPharmacyHour,
    });
    assert.equal(p.ok, false);
    if (!p.ok) assert.equal(p.scope, 'pharmacy');
  });
});

describe('rateLimitUserMessage', () => {
  it('mensajes comprensibles por alcance', () => {
    assert.match(rateLimitUserMessage('turn'), /máximo de consultas/i);
    assert.match(rateLimitUserMessage('device'), /kiosko/i);
    assert.match(rateLimitUserMessage('pharmacy'), /farmacia/i);
  });
});
