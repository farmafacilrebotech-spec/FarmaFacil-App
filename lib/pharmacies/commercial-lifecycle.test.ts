/**
 * Pruebas de ciclo comercial (espejo SQL 027–029).
 * npm run test:commercial-lifecycle
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NONPAYMENT_GRACE_DAYS,
  TRIAL_DAYS,
  addDaysIso,
  evaluatePharmacyOperability,
  listVisibleCommercialActions,
  projectCommercialTransition,
  validateCommercialTransition,
  type CommercialSnapshot,
} from './commercial-lifecycle.ts';

const now = new Date('2026-06-15T12:00:00.000Z');

function base(
  overrides: Partial<CommercialSnapshot> = {}
): CommercialSnapshot {
  return {
    pharmacyStatus: 'pending_setup',
    subscriptionStatus: 'trialing',
    trialEnd: addDaysIso(now, 20),
    currentPeriodEnd: addDaysIso(now, 20),
    cancelAtPeriodEnd: false,
    gracePeriodEndsAt: null,
    now,
    ...overrides,
  };
}

describe('constants', () => {
  it('uses approved trial and grace lengths', () => {
    assert.equal(TRIAL_DAYS, 30);
    assert.equal(NONPAYMENT_GRACE_DAYS, 7);
  });
});

describe('evaluatePharmacyOperability', () => {
  it('allows pending_setup during valid trial', () => {
    const r = evaluatePharmacyOperability(base());
    assert.equal(r.operable, true);
    assert.equal(r.reason, 'ok');
  });

  it('blocks expired trial without contract', () => {
    const r = evaluatePharmacyOperability(
      base({ trialEnd: addDaysIso(now, -1) })
    );
    assert.equal(r.operable, false);
    assert.equal(r.reason, 'trial_ended');
  });

  it('blocks trialing without trial_end (SQL parity)', () => {
    const r = evaluatePharmacyOperability(base({ trialEnd: null }));
    assert.equal(r.operable, false);
    assert.equal(r.reason, 'trial_ended');
  });

  it('blocks past_due without grace_period_ends_at (SQL parity)', () => {
    const r = evaluatePharmacyOperability(
      base({
        pharmacyStatus: 'active',
        subscriptionStatus: 'past_due',
        gracePeriodEndsAt: null,
      })
    );
    assert.equal(r.operable, false);
    assert.equal(r.reason, 'grace_ended');
  });

  it('blocks cancel_at_period_end without current_period_end (SQL parity)', () => {
    const r = evaluatePharmacyOperability(
      base({
        pharmacyStatus: 'active',
        subscriptionStatus: 'active',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: null,
        trialEnd: null,
      })
    );
    assert.equal(r.operable, false);
    assert.equal(r.reason, 'period_ended_after_cancel');
  });

  it('allows active without period_end when not cancelling', () => {
    const r = evaluatePharmacyOperability(
      base({
        pharmacyStatus: 'active',
        subscriptionStatus: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        trialEnd: null,
      })
    );
    assert.equal(r.operable, true);
  });

  it('allows active subscription', () => {
    const r = evaluatePharmacyOperability(
      base({
        pharmacyStatus: 'active',
        subscriptionStatus: 'active',
        trialEnd: null,
        currentPeriodEnd: addDaysIso(now, 30),
      })
    );
    assert.equal(r.operable, true);
  });

  it('allows cancel_at_period_end until period end', () => {
    const r = evaluatePharmacyOperability(
      base({
        pharmacyStatus: 'active',
        subscriptionStatus: 'active',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: addDaysIso(now, 5),
      })
    );
    assert.equal(r.operable, true);
  });

  it('blocks after period end when cancel_at_period_end', () => {
    const r = evaluatePharmacyOperability(
      base({
        pharmacyStatus: 'active',
        subscriptionStatus: 'active',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: addDaysIso(now, -1),
      })
    );
    assert.equal(r.operable, false);
    assert.equal(r.reason, 'period_ended_after_cancel');
  });

  it('allows past_due inside grace', () => {
    const r = evaluatePharmacyOperability(
      base({
        pharmacyStatus: 'active',
        subscriptionStatus: 'past_due',
        gracePeriodEndsAt: addDaysIso(now, 3),
      })
    );
    assert.equal(r.operable, true);
  });

  it('blocks past_due after grace', () => {
    const r = evaluatePharmacyOperability(
      base({
        pharmacyStatus: 'active',
        subscriptionStatus: 'past_due',
        gracePeriodEndsAt: addDaysIso(now, -1),
      })
    );
    assert.equal(r.operable, false);
    assert.equal(r.reason, 'grace_ended');
  });

  it('blocks pharmacy suspended even with active sub', () => {
    const r = evaluatePharmacyOperability(
      base({
        pharmacyStatus: 'suspended',
        subscriptionStatus: 'active',
        currentPeriodEnd: addDaysIso(now, 10),
      })
    );
    assert.equal(r.operable, false);
    assert.equal(r.reason, 'pharmacy_suspended');
  });

  it('blocks cancelled and expired', () => {
    assert.equal(
      evaluatePharmacyOperability(
        base({ subscriptionStatus: 'cancelled' })
      ).operable,
      false
    );
    assert.equal(
      evaluatePharmacyOperability(
        base({ subscriptionStatus: 'expired' })
      ).operable,
      false
    );
  });

  it('does not treat archived as commercial cancel side-effect check', () => {
    const r = evaluatePharmacyOperability(
      base({ pharmacyStatus: 'archived', subscriptionStatus: 'active' })
    );
    assert.equal(r.operable, false);
    assert.equal(r.reason, 'pharmacy_archived');
  });
});

describe('validateCommercialTransition', () => {
  it('accepts cancel_at_period_end with future period', () => {
    assert.equal(
      validateCommercialTransition('cancel_at_period_end', base()).ok,
      true
    );
  });

  it('rejects cancel_at_period_end without future end', () => {
    const r = validateCommercialTransition(
      'cancel_at_period_end',
      base({ trialEnd: addDaysIso(now, -1), currentPeriodEnd: null })
    );
    assert.equal(r.ok, false);
  });

  it('rejects cancel_now when already cancelled', () => {
    const r = validateCommercialTransition(
      'cancel_now',
      base({ subscriptionStatus: 'cancelled' })
    );
    assert.equal(r.ok, false);
  });

  it('rejects start_nonpayment_grace when pharmacy suspended', () => {
    const r = validateCommercialTransition(
      'start_nonpayment_grace',
      base({ pharmacyStatus: 'suspended', subscriptionStatus: 'active' })
    );
    assert.equal(r.ok, false);
  });

  it('rejects suspend/reactivate on archived', () => {
    assert.equal(
      validateCommercialTransition(
        'suspend_for_nonpayment',
        base({ pharmacyStatus: 'archived' })
      ).ok,
      false
    );
    assert.equal(
      validateCommercialTransition(
        'reactivate',
        base({ pharmacyStatus: 'archived', subscriptionStatus: 'cancelled' })
      ).ok,
      false
    );
  });
});

describe('listVisibleCommercialActions', () => {
  it('shows cancel options and grace for active subscription', () => {
    const actions = listVisibleCommercialActions(
      base({
        pharmacyStatus: 'active',
        subscriptionStatus: 'active',
        currentPeriodEnd: addDaysIso(now, 20),
        trialEnd: null,
      })
    );
    assert.ok(actions.includes('cancel_at_period_end'));
    assert.ok(actions.includes('cancel_now'));
    assert.ok(actions.includes('start_nonpayment_grace'));
    assert.ok(actions.includes('suspend_for_nonpayment'));
    assert.equal(actions.includes('reactivate'), false);
  });

  it('shows reactivate when cancelled, not cancel_now', () => {
    const actions = listVisibleCommercialActions(
      base({
        pharmacyStatus: 'active',
        subscriptionStatus: 'cancelled',
        trialEnd: null,
        currentPeriodEnd: null,
      })
    );
    assert.ok(actions.includes('reactivate'));
    assert.equal(actions.includes('cancel_now'), false);
    assert.equal(actions.includes('cancel_at_period_end'), false);
  });

  it('shows reactivate when pharmacy suspended', () => {
    const actions = listVisibleCommercialActions(
      base({
        pharmacyStatus: 'suspended',
        subscriptionStatus: 'past_due',
        gracePeriodEndsAt: addDaysIso(now, -1),
        trialEnd: null,
      })
    );
    assert.ok(actions.includes('reactivate'));
    assert.equal(actions.includes('start_nonpayment_grace'), false);
  });

  it('hides cancel_at_period_end without future period end', () => {
    const actions = listVisibleCommercialActions(
      base({
        pharmacyStatus: 'active',
        subscriptionStatus: 'active',
        currentPeriodEnd: null,
        trialEnd: null,
      })
    );
    assert.equal(actions.includes('cancel_at_period_end'), false);
    assert.ok(actions.includes('cancel_now'));
  });
});

describe('projectCommercialTransition', () => {
  it('cancel_at_period_end keeps access until end', () => {
    const next = projectCommercialTransition('cancel_at_period_end', base());
    assert.equal(next.cancelAtPeriodEnd, true);
    assert.equal(next.subscriptionStatus, 'trialing');
    assert.equal(evaluatePharmacyOperability(next).operable, true);
  });

  it('cancel_now blocks immediately and does not archive pharmacy', () => {
    const next = projectCommercialTransition(
      'cancel_now',
      base({ pharmacyStatus: 'active', subscriptionStatus: 'active' })
    );
    assert.equal(next.subscriptionStatus, 'cancelled');
    assert.equal(next.pharmacyStatus, 'active');
    assert.equal(evaluatePharmacyOperability(next).operable, false);
  });

  it('start_nonpayment_grace keeps operable for 7 days', () => {
    const next = projectCommercialTransition(
      'start_nonpayment_grace',
      base({ pharmacyStatus: 'active', subscriptionStatus: 'active' })
    );
    assert.equal(next.subscriptionStatus, 'past_due');
    assert.ok(next.gracePeriodEndsAt);
    const grace = new Date(next.gracePeriodEndsAt!);
    const expected = new Date(now);
    expected.setUTCDate(expected.getUTCDate() + NONPAYMENT_GRACE_DAYS);
    assert.equal(grace.toISOString(), expected.toISOString());
    assert.equal(evaluatePharmacyOperability(next).operable, true);
  });

  it('suspend_for_nonpayment blocks operationally', () => {
    const next = projectCommercialTransition(
      'suspend_for_nonpayment',
      base({ pharmacyStatus: 'active', subscriptionStatus: 'past_due' })
    );
    assert.equal(next.pharmacyStatus, 'suspended');
    assert.equal(evaluatePharmacyOperability(next).operable, false);
  });

  it('reactivate restores access without changing memberships (status only)', () => {
    const next = projectCommercialTransition(
      'reactivate',
      base({
        pharmacyStatus: 'suspended',
        subscriptionStatus: 'past_due',
        gracePeriodEndsAt: addDaysIso(now, -1),
      })
    );
    assert.equal(next.pharmacyStatus, 'active');
    assert.equal(next.subscriptionStatus, 'active');
    assert.equal(next.cancelAtPeriodEnd, false);
    assert.equal(next.gracePeriodEndsAt, null);
    assert.equal(evaluatePharmacyOperability(next).operable, true);
  });

  it('reactivate from cancel_now restores operable active sub', () => {
    const cancelled = projectCommercialTransition(
      'cancel_now',
      base({ pharmacyStatus: 'active', subscriptionStatus: 'active' })
    );
    const next = projectCommercialTransition('reactivate', cancelled);
    assert.equal(next.subscriptionStatus, 'active');
    assert.equal(evaluatePharmacyOperability(next).operable, true);
  });
});
