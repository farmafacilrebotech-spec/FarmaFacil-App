import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assistantModuleCurrentlyUsable,
  parseAssistantEntitlementRow,
  resolveAssistantCommercialUiState,
} from './entitlement-status.ts';

describe('assistant entitlement status', () => {
  it('no concede demo sin registro', () => {
    assert.equal(resolveAssistantCommercialUiState(null), 'not_contracted');
    assert.equal(assistantModuleCurrentlyUsable(null), false);
  });

  it('demo trial activa y caducada', () => {
    const active = parseAssistantEntitlementRow({
      status: 'trial',
      source: 'addon',
      ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      config: { mode: 'demo' },
      limits: { monthly_request_limit: 50 },
    });
    assert.equal(resolveAssistantCommercialUiState(active), 'demo_active');
    assert.equal(assistantModuleCurrentlyUsable(active), true);

    const expired = parseAssistantEntitlementRow({
      status: 'trial',
      source: 'addon',
      ends_at: new Date(Date.now() - 1000).toISOString(),
      config: { mode: 'demo' },
      limits: { monthly_request_limit: 50 },
    });
    assert.equal(resolveAssistantCommercialUiState(expired), 'demo_expired');
    assert.equal(assistantModuleCurrentlyUsable(expired), false);
  });

  it('contratado activo con consult flag', () => {
    const row = parseAssistantEntitlementRow({
      status: 'active',
      source: 'addon',
      ends_at: null,
      config: { mode: 'contracted', pharmacist_consult_enabled: true },
      limits: { monthly_request_limit: 1000 },
    });
    assert.equal(resolveAssistantCommercialUiState(row), 'contracted_active');
    assert.equal(row.pharmacistConsultEnabled, true);
    assert.equal(assistantModuleCurrentlyUsable(row), true);
  });

  it('suspendido / cancelado no usable', () => {
    const suspended = parseAssistantEntitlementRow({
      status: 'suspended',
      source: 'addon',
      ends_at: null,
      config: { mode: 'contracted' },
      limits: { monthly_request_limit: 100 },
    });
    assert.equal(resolveAssistantCommercialUiState(suspended), 'suspended');
    assert.equal(assistantModuleCurrentlyUsable(suspended), false);
  });

  it('SuperAdmin demo vs contratado: modos y límites distintos', () => {
    const demo = parseAssistantEntitlementRow({
      status: 'trial',
      source: 'addon',
      ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      config: { mode: 'demo', pharmacist_consult_enabled: false },
      limits: { monthly_request_limit: 50 },
    });
    const contracted = parseAssistantEntitlementRow({
      status: 'active',
      source: 'addon',
      ends_at: null,
      config: { mode: 'contracted', pharmacist_consult_enabled: true },
      limits: { monthly_request_limit: 2000 },
    });
    assert.equal(resolveAssistantCommercialUiState(demo), 'demo_active');
    assert.equal(demo.monthlyRequestLimit, 50);
    assert.equal(demo.pharmacistConsultEnabled, false);
    assert.equal(
      resolveAssistantCommercialUiState(contracted),
      'contracted_active'
    );
    assert.equal(contracted.monthlyRequestLimit, 2000);
    assert.equal(contracted.pharmacistConsultEnabled, true);
  });
});
