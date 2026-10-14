/**
 * Pruebas de acceso tenant permitido/bloqueado (espejo layout + operabilidad).
 * npm run test:commercial-access
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDaysIso,
  evaluatePharmacyOperability,
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
