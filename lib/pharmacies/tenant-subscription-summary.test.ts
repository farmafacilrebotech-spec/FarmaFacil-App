import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildTenantSubscriptionSummary,
  canViewTenantSubscriptionSummary,
} from './tenant-subscription-summary.ts';
import type { PharmacySubscription } from './types';

function sub(
  overrides: Partial<PharmacySubscription> = {}
): PharmacySubscription {
  return {
    id: 'sub-1',
    status: 'trialing',
    provider: 'manual',
    current_period_start: null,
    current_period_end: '2026-11-15T00:00:00.000Z',
    trial_start: '2026-10-01T00:00:00.000Z',
    trial_end: '2026-10-30T00:00:00.000Z',
    cancel_at_period_end: false,
    cancelled_at: null,
    grace_period_ends_at: null,
    commercial_reason: null,
    plan: {
      id: 'plan-1',
      key: 'starter',
      name: 'Starter',
      description: null,
      is_active: true,
      sort_order: 1,
    },
    ...overrides,
  };
}

describe('tenant subscription summary visibility', () => {
  it('allows OWNER and ADMIN only', () => {
    assert.equal(canViewTenantSubscriptionSummary('PHARMACY_OWNER'), true);
    assert.equal(canViewTenantSubscriptionSummary('PHARMACY_ADMIN'), true);
    assert.equal(canViewTenantSubscriptionSummary('PHARMACIST'), false);
    assert.equal(canViewTenantSubscriptionSummary('STAFF'), false);
  });
});

describe('buildTenantSubscriptionSummary', () => {
  it('maps plan, subscription dates and kiosk state as provided', () => {
    const summary = buildTenantSubscriptionSummary({
      subscription: sub({ cancel_at_period_end: true }),
      pharmacyPlan: null,
      kioskAddonLabel: 'Kiosko cancelado',
      kioskAddonDescription:
        'El módulo está cancelado. Los dispositivos se conservan pero no pueden usarse.',
      kioskEndsAt: '2026-10-01T00:00:00.000Z',
    });

    assert.equal(summary.planName, 'Starter');
    assert.equal(summary.subscriptionStatusLabel, 'Periodo de prueba');
    assert.equal(summary.trialEnd, '2026-10-30T00:00:00.000Z');
    assert.equal(summary.periodEnd, '2026-11-15T00:00:00.000Z');
    assert.equal(summary.cancelAtPeriodEnd, true);
    assert.equal(summary.kioskAddonLabel, 'Kiosko cancelado');
  });

  it('falls back to pharmacy plan when subscription has no plan', () => {
    const summary = buildTenantSubscriptionSummary({
      subscription: sub({ plan: null }),
      pharmacyPlan: {
        id: 'plan-2',
        key: 'pro',
        name: 'Pro',
        description: null,
        is_active: true,
        sort_order: 2,
      },
      kioskAddonLabel: 'Kiosko no contratado',
      kioskAddonDescription: '…',
      kioskEndsAt: null,
    });
    assert.equal(summary.planName, 'Pro');
  });

  it('handles missing subscription without inventing billing data', () => {
    const summary = buildTenantSubscriptionSummary({
      subscription: null,
      pharmacyPlan: null,
      kioskAddonLabel: 'Kiosko no contratado',
      kioskAddonDescription: '…',
      kioskEndsAt: null,
    });
    assert.equal(summary.planName, null);
    assert.equal(summary.subscriptionStatusLabel, null);
    assert.equal(summary.trialEnd, null);
    assert.equal(summary.periodEnd, null);
    assert.equal(summary.cancelAtPeriodEnd, false);
  });
});
