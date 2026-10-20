import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ASSISTANT_RATE_MAX_PER_DEVICE,
  checkAssistantRateLimit,
} from './rate-limit.ts';

describe('checkAssistantRateLimit', () => {
  it('permite hasta el máximo por dispositivo y luego bloquea', () => {
    const device = new Map();
    const pharmacy = new Map();
    const now = 1_000_000;
    for (let i = 0; i < ASSISTANT_RATE_MAX_PER_DEVICE; i++) {
      const r = checkAssistantRateLimit({
        pharmacyId: 'ph-a',
        deviceId: 'dev-a',
        nowMs: now,
        stores: { device, pharmacy },
      });
      assert.equal(r.allowed, true);
    }
    const blocked = checkAssistantRateLimit({
      pharmacyId: 'ph-a',
      deviceId: 'dev-a',
      nowMs: now,
      stores: { device, pharmacy },
    });
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.scope, 'device');
  });

  it('aisla contadores entre dispositivos', () => {
    const device = new Map();
    const pharmacy = new Map();
    const now = 2_000_000;
    for (let i = 0; i < ASSISTANT_RATE_MAX_PER_DEVICE; i++) {
      checkAssistantRateLimit({
        pharmacyId: 'ph-a',
        deviceId: 'dev-1',
        nowMs: now,
        stores: { device, pharmacy },
      });
    }
    const other = checkAssistantRateLimit({
      pharmacyId: 'ph-a',
      deviceId: 'dev-2',
      nowMs: now,
      stores: { device, pharmacy },
    });
    assert.equal(other.allowed, true);
  });
});
