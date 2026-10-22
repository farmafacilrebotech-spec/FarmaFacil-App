/**
 * Pruebas de acceso tenant permitido/bloqueado (espejo layout + operabilidad).
 * npm run test:commercial-access
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysIso,
  evaluatePharmacyOperability,
  listVisibleCommercialActions,
  resolvePharmacyCommercialAccess,
  type CommercialSnapshot,
} from './commercial-lifecycle.ts';

const now = new Date('2026-06-15T12:00:00.000Z');

function snap(
  overrides: Partial<CommercialSnapshot> = {}
): CommercialSnapshot {
  return {
    pharmacyStatus: 'active',
    subscriptionStatus: 'active',
    trialEnd: null,
    currentPeriodEnd: addDaysIso(now, 30),
    cancelAtPeriodEnd: false,
    gracePeriodEndsAt: null,
    now,
    ...overrides,
  };
}

/** Decisión del layout tenant: ¿renderizar operaciones o pantalla suspendida? */
function allowTenantOperations(snapshot: CommercialSnapshot): boolean {
  return evaluatePharmacyOperability(snapshot).operable;
}

describe('tenant route commercial gate', () => {
  it('allows pending_setup during valid trial', () => {
    assert.equal(
      allowTenantOperations(
        snap({
          pharmacyStatus: 'pending_setup',
          subscriptionStatus: 'trialing',
          trialEnd: addDaysIso(now, 10),
          currentPeriodEnd: addDaysIso(now, 10),
        })
      ),
      true
    );
  });

  it('blocks catalog/orders/config when trial ended', () => {
    assert.equal(
      allowTenantOperations(
        snap({
          pharmacyStatus: 'pending_setup',
          subscriptionStatus: 'trialing',
          trialEnd: addDaysIso(now, -1),
        })
      ),
      false
    );
  });

  it('blocks when pharmacy suspended for nonpayment', () => {
    assert.equal(
      allowTenantOperations(
        snap({
          pharmacyStatus: 'suspended',
          subscriptionStatus: 'past_due',
          gracePeriodEndsAt: addDaysIso(now, -1),
        })
      ),
      false
    );
  });

  it('allows during nonpayment grace', () => {
    assert.equal(
      allowTenantOperations(
        snap({
          subscriptionStatus: 'past_due',
          gracePeriodEndsAt: addDaysIso(now, 3),
        })
      ),
      true
    );
  });

  it('blocks immediate cancel', () => {
    assert.equal(
      allowTenantOperations(snap({ subscriptionStatus: 'cancelled' })),
      false
    );
  });

  it('allows cancel_at_period_end before period end', () => {
    assert.equal(
      allowTenantOperations(
        snap({
          cancelAtPeriodEnd: true,
          currentPeriodEnd: addDaysIso(now, 5),
        })
      ),
      true
    );
  });

  it('blocks cancel_at_period_end after period end', () => {
    assert.equal(
      allowTenantOperations(
        snap({
          cancelAtPeriodEnd: true,
          currentPeriodEnd: addDaysIso(now, -1),
        })
      ),
      false
    );
  });

  it('blocks trialing without trial_end (legacy)', () => {
    assert.equal(
      allowTenantOperations(
        snap({
          pharmacyStatus: 'pending_setup',
          subscriptionStatus: 'trialing',
          trialEnd: null,
        })
      ),
      false
    );
  });
});

describe('platform vs tenant privilege matrix (documented)', () => {
  it('tenant blocked does not imply SuperAdmin blocked (orthogonal axes)', () => {
    // Documentación ejecutable: operabilidad tenant es independiente de platform.*.
    const tenantBlocked = !allowTenantOperations(
      snap({ pharmacyStatus: 'suspended', subscriptionStatus: 'past_due' })
    );
    const platformMayManage = true; // platform.users.write / pharmacies.write
    assert.equal(tenantBlocked, true);
    assert.equal(platformMayManage, true);
  });

  it('soft-lock needs pharmacies+subscriptions readable; products do not', () => {
    // Matriz de políticas 032 (documentada):
    // soft-lock SELECT: pharmacies, subscriptions, own memberships = sí sin operable
    // operativo SELECT: products, branding, settings, entrypoints, entitlements = no
    const softLockTablesWithoutOperable = [
      'pharmacies',
      'subscriptions',
      'pharmacy_memberships',
    ];
    const operationalSelectRequiresOperable = [
      'pharmacy_products',
      'pharmacy_branding',
      'pharmacy_settings',
      'public_entrypoints',
      'pharmacy_entitlements',
      'activity_events',
    ];
    assert.ok(softLockTablesWithoutOperable.includes('pharmacies'));
    assert.ok(operationalSelectRequiresOperable.includes('pharmacy_products'));
    assert.equal(
      softLockTablesWithoutOperable.includes('pharmacy_products'),
      false
    );
  });
});

describe('resolvePharmacyCommercialAccess (piloto + legacy)', () => {
  it('piloto ready + legacy cancelled → preparation, not cancelled', () => {
    const r = resolvePharmacyCommercialAccess({
      pharmacyStatus: 'pending_setup',
      subscriptionStatus: 'cancelled',
      trial: { status: 'ready', activatedAt: null, endsAt: null },
      now,
    });
    assert.equal(r.accessMode, 'preparation');
    assert.equal(r.operable, false);
    assert.equal(r.reason, 'pilot_ready_pending_activation');
  });

  it('piloto active + suscripción trialing vigente → operational', () => {
    const r = resolvePharmacyCommercialAccess({
      pharmacyStatus: 'pending_setup',
      subscriptionStatus: 'trialing',
      trialEnd: addDaysIso(now, 10),
      trial: {
        status: 'active',
        activatedAt: addDaysIso(now, -1),
        endsAt: addDaysIso(now, 14),
      },
      now,
    });
    assert.equal(r.accessMode, 'operational');
    assert.equal(r.operable, true);
    assert.equal(r.reason, 'ok');
  });

  it('piloto active con endsAt pasado → blocked pilot_expired', () => {
    const r = resolvePharmacyCommercialAccess({
      pharmacyStatus: 'pending_setup',
      subscriptionStatus: 'trialing',
      trialEnd: addDaysIso(now, -1),
      trial: {
        status: 'active',
        activatedAt: addDaysIso(now, -20),
        endsAt: addDaysIso(now, -1),
      },
      now,
    });
    assert.equal(r.accessMode, 'blocked');
    assert.equal(r.operable, false);
    assert.equal(r.reason, 'pilot_expired');
  });

  it('legacy cancelled sin piloto → blocked subscription_cancelled', () => {
    const r = resolvePharmacyCommercialAccess({
      pharmacyStatus: 'pending_setup',
      subscriptionStatus: 'cancelled',
      trial: null,
      now,
    });
    assert.equal(r.accessMode, 'blocked');
    assert.equal(r.operable, false);
    assert.equal(r.reason, 'subscription_cancelled');
  });

  it('piloto ended → blocked pilot_ended', () => {
    const r = resolvePharmacyCommercialAccess({
      pharmacyStatus: 'pending_setup',
      subscriptionStatus: 'cancelled',
      trial: { status: 'ended', endsAt: addDaysIso(now, -1) },
      now,
    });
    assert.equal(r.accessMode, 'blocked');
    assert.equal(r.reason, 'pilot_ended');
  });

  it('hide reactivate when open pilot', () => {
    const actions = listVisibleCommercialActions(
      snap({ subscriptionStatus: 'cancelled' }),
      { hideReactivateForOpenPilot: true }
    );
    assert.equal(actions.includes('reactivate'), false);
  });
});
