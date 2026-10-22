import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PLAN_CATALOG_EXPECTATIONS } from './plan-catalog-mode.ts';
import {
  COMMERCIAL_ONBOARDING_PLAN_CODES,
  COMMERCIAL_PILOT_DURATION_DAYS,
  COMMERCIAL_PILOT_MASTER_CATALOG_COUNT,
  COMMERCIAL_PREP_RPC,
  LEGACY_CREATE_PHARMACY_RPC,
  buildLegacyToCommercialPilotConversionPlan,
  classifyPharmacyCommercialShape,
  expectedPrepOutcome,
  listOnboardingModalities,
  resolveCreatePharmacyRoute,
} from './pharmacy-onboarding.ts';
import {
  inviteBlockMessageForMembership,
  resolveInviteAgainstExistingMembership,
} from '../pharmacies/membership-invite-state.ts';

describe('alta comercial SuperAdmin', () => {
  it('Piloto crea vía prep sin iniciar reloj', () => {
    const route = resolveCreatePharmacyRoute('piloto');
    assert.equal(route.ok, true);
    if (!route.ok) return;
    assert.equal(route.rpc, COMMERCIAL_PREP_RPC);
    assert.equal(route.startsClock, false);
    assert.notEqual(route.rpc, LEGACY_CREATE_PHARMACY_RPC);

    const prep = expectedPrepOutcome();
    assert.equal(prep.clockStarted, false);
    assert.equal(prep.subscriptionId, null);
    assert.equal(prep.trialStatus, 'ready');
    assert.equal(prep.masterCatalogMin, COMMERCIAL_PILOT_MASTER_CATALOG_COUNT);
  });

  it('tras activación la duración esperada es 15 días', () => {
    assert.equal(COMMERCIAL_PILOT_DURATION_DAYS, 15);
    assert.equal(expectedPrepOutcome().pilotDaysAfterActivate, 15);
  });

  it('catálogo genérico esperado = 100', () => {
    assert.equal(COMMERCIAL_PILOT_MASTER_CATALOG_COUNT, 100);
    const piloto = listOnboardingModalities().find((m) => m.planCode === 'piloto');
    assert.ok(piloto?.creatable);
    if (piloto?.creatable) {
      assert.equal(piloto.expectedCatalogCount, 100);
      assert.equal(piloto.attachesMasterCatalog, true);
    }
  });

  it('separa los cuatro planes y solo Piloto es creable hoy', () => {
    const modalities = listOnboardingModalities();
    assert.equal(modalities.length, 4);
    assert.deepEqual(
      COMMERCIAL_ONBOARDING_PLAN_CODES,
      PLAN_CATALOG_EXPECTATIONS.map((p) => p.planCode)
    );
    assert.deepEqual(
      modalities.map((m) => m.planCode),
      COMMERCIAL_ONBOARDING_PLAN_CODES
    );

    const creatable = modalities.filter((m) => m.creatable);
    assert.equal(creatable.length, 1);
    assert.equal(creatable[0]?.planCode, 'piloto');

    for (const code of [
      'general',
      'personalizado',
      'asistente_ia_personalizado',
    ] as const) {
      const r = resolveCreatePharmacyRoute(code);
      assert.equal(r.ok, false);
      if (!r.ok) {
        assert.equal(r.code, 'plan_not_creatable');
        assert.match(r.error, /056|contratad/i);
      }
    }
  });

  it('compatibilidad: distingue legacy 30d de prep comercial', () => {
    const legacy = classifyPharmacyCommercialShape({
      hasCommercialTrial: false,
      commercialTrialStatus: null,
      subscriptionStatus: 'trialing',
      trialStart: '2026-10-21T14:55:10.037Z',
      trialEnd: '2026-11-20T14:55:10.037Z',
      genericProductCount: 0,
    });
    assert.equal(legacy.shape, 'legacy_trial_30d');
    assert.equal(legacy.clockStarted, true);

    const prep = classifyPharmacyCommercialShape({
      hasCommercialTrial: true,
      commercialTrialStatus: 'ready',
      subscriptionStatus: null,
      trialStart: null,
      trialEnd: null,
      genericProductCount: 100,
    });
    assert.equal(prep.shape, 'commercial_prep');
    assert.equal(prep.clockStarted, false);

    const active = classifyPharmacyCommercialShape({
      hasCommercialTrial: true,
      commercialTrialStatus: 'active',
      subscriptionStatus: 'trialing',
      trialStart: '2026-10-21T00:00:00.000Z',
      trialEnd: '2026-11-05T00:00:00.000Z',
      genericProductCount: 100,
    });
    assert.equal(active.shape, 'commercial_active');
    assert.equal(active.clockStarted, true);
  });
});

describe('invitación propietario (sin I/O)', () => {
  it('bloquea re-invitar si ya está invited (usar reenvío)', () => {
    const decision = resolveInviteAgainstExistingMembership({
      id: 'm1',
      status: 'invited',
      accepted_at: null,
    });
    assert.equal(decision.kind, 'block');
    const msg = inviteBlockMessageForMembership('invited', null);
    assert.match(msg, /Reenviar invitación/);
  });

  it('no duplica: invited pendiente → block; revoked cancelada → reinvite', () => {
    assert.equal(
      resolveInviteAgainstExistingMembership({
        id: 'a',
        status: 'invited',
        accepted_at: null,
      }).kind,
      'block'
    );
    assert.equal(
      resolveInviteAgainstExistingMembership({
        id: 'b',
        status: 'revoked',
        accepted_at: null,
      }).kind,
      'reinvite'
    );
    assert.equal(
      resolveInviteAgainstExistingMembership({
        id: 'c',
        status: 'active',
        accepted_at: '2026-01-01',
      }).kind,
      'block'
    );
  });
});

describe('conversión farmacia TEST legacy', () => {
  it('plan de conversión exige autorización y no activa reloj', () => {
    const plan = buildLegacyToCommercialPilotConversionPlan({
      pharmacyId: 'af477147-a1cf-4520-b4cf-ba65596d6f4a',
      pharmacyName: 'Farmacia Prueba Piloto',
      subscriptionId: 'sub-1',
      subscriptionStatus: 'trialing',
      trialEnd: '2026-11-20T14:55:10.037Z',
      membershipInvitedOwner: true,
      genericProductCount: 0,
    });
    assert.equal(plan.requiresAuthorization, true);
    assert.ok(
      plan.proposed.some((s) => /NO llamar ff_commercial_trial_activate/i.test(s))
    );
    assert.ok(plan.prechecks.some((s) => /autorización/i.test(s)));
    assert.ok(plan.rollback.length >= 2);
  });
});
