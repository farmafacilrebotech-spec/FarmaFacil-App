import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  kioskModuleCurrentlyUsable,
  resolveKioskCommercialUiState,
} from './entitlement-status.ts';

const NOW = Date.parse('2026-10-15T12:00:00.000Z');
const FUTURE = '2026-11-01T00:00:00.000Z';
const PAST = '2026-09-01T00:00:00.000Z';

describe('kiosk commercial UI state', () => {
  it('null entitlement → not_contracted and not usable', () => {
    assert.equal(resolveKioskCommercialUiState(null, NOW), 'not_contracted');
    assert.equal(kioskModuleCurrentlyUsable(null, NOW), false);
  });

  it('active addon → usable', () => {
    const e = { status: 'active' as const, source: 'addon' as const, endsAt: null };
    assert.equal(resolveKioskCommercialUiState(e, NOW), 'active');
    assert.equal(kioskModuleCurrentlyUsable(e, NOW), true);
  });

  it('trial with future ends_at → trial_active usable', () => {
    const e = {
      status: 'trial' as const,
      source: 'addon' as const,
      endsAt: FUTURE,
    };
    assert.equal(resolveKioskCommercialUiState(e, NOW), 'trial_active');
    assert.equal(kioskModuleCurrentlyUsable(e, NOW), true);
  });

  it('trial with past ends_at → trial_expired not usable', () => {
    const e = {
      status: 'trial' as const,
      source: 'addon' as const,
      endsAt: PAST,
    };
    assert.equal(resolveKioskCommercialUiState(e, NOW), 'trial_expired');
    assert.equal(kioskModuleCurrentlyUsable(e, NOW), false);
  });

  it('suspended / cancelled → not usable (devices blocked, not deleted)', () => {
    assert.equal(
      resolveKioskCommercialUiState(
        { status: 'suspended', source: 'addon', endsAt: null },
        NOW
      ),
      'suspended'
    );
    assert.equal(
      kioskModuleCurrentlyUsable(
        { status: 'suspended', source: 'addon', endsAt: null },
        NOW
      ),
      false
    );
    assert.equal(
      resolveKioskCommercialUiState(
        { status: 'cancelled', source: 'addon', endsAt: PAST },
        NOW
      ),
      'cancelled'
    );
    assert.equal(
      kioskModuleCurrentlyUsable(
        { status: 'cancelled', source: 'addon', endsAt: PAST },
        NOW
      ),
      false
    );
  });
});
