/**
 * Alta comercial SuperAdmin — reglas de negocio (sin I/O).
 *
 * Piloto → ff_create_pharmacy_commercial_prep_v1 (sin reloj).
 * General / Personalizado / IA → no crear como contratados hasta migración 056.
 * Legacy ff_create_pharmacy_v1 (30d trialing) queda fuera del alta nueva.
 *
 * Módulo puro (sin path aliases) para tests Node strip-types.
 */

/** Días del piloto tras activación explícita (RPC 050). */
export const COMMERCIAL_PILOT_DURATION_DAYS = 15;

/** Productos genéricos del catálogo maestro adjuntos en prep. */
export const COMMERCIAL_PILOT_MASTER_CATALOG_COUNT = 100;

/** RPC de preparación (sin suscripción / sin reloj). */
export const COMMERCIAL_PREP_RPC = 'ff_create_pharmacy_commercial_prep_v1' as const;

/** RPC legacy (trial 30d al crear) — no usar en altas nuevas. */
export const LEGACY_CREATE_PHARMACY_RPC = 'ff_create_pharmacy_v1' as const;

export const PLAN_ASSIGN_DRAFT =
  'supabase/drafts/056_commercial_plan_assign_catalog_mode_v1.sql' as const;

export type CommercialOnboardingPlanCode =
  | 'piloto'
  | 'general'
  | 'personalizado'
  | 'asistente_ia_personalizado';

export const COMMERCIAL_ONBOARDING_PLAN_CODES: CommercialOnboardingPlanCode[] = [
  'piloto',
  'general',
  'personalizado',
  'asistente_ia_personalizado',
];

const LABELS: Record<CommercialOnboardingPlanCode, string> = {
  piloto: 'Piloto',
  general: 'General',
  personalizado: 'Personalizado',
  asistente_ia_personalizado: 'Asistente IA personalizado',
};

export type OnboardingModalityAvailability =
  | {
      planCode: CommercialOnboardingPlanCode;
      label: string;
      creatable: true;
      createVia: typeof COMMERCIAL_PREP_RPC;
      startsClock: false;
      attachesMasterCatalog: true;
      expectedCatalogCount: typeof COMMERCIAL_PILOT_MASTER_CATALOG_COUNT;
      summary: string;
    }
  | {
      planCode: CommercialOnboardingPlanCode;
      label: string;
      creatable: false;
      reason: 'plan_assign_not_implemented';
      blockedBy: typeof PLAN_ASSIGN_DRAFT;
      summary: string;
    };

export function listOnboardingModalities(): OnboardingModalityAvailability[] {
  return COMMERCIAL_ONBOARDING_PLAN_CODES.map((planCode) =>
    modalityAvailability(planCode)
  );
}

export function modalityAvailability(
  planCode: CommercialOnboardingPlanCode
): OnboardingModalityAvailability {
  const label = LABELS[planCode];
  if (planCode === 'piloto') {
    return {
      planCode: 'piloto',
      label,
      creatable: true,
      createVia: COMMERCIAL_PREP_RPC,
      startsClock: false,
      attachesMasterCatalog: true,
      expectedCatalogCount: COMMERCIAL_PILOT_MASTER_CATALOG_COUNT,
      summary:
        'Prepara piloto 15 días en estado ready. No crea suscripción ni inicia el reloj. Adjunta catálogo genérico (100). Activación solo tras readiness.',
    };
  }

  return {
    planCode,
    label,
    creatable: false,
    reason: 'plan_assign_not_implemented',
    blockedBy: PLAN_ASSIGN_DRAFT,
    summary: `${label}: la contratación/asignación de plan aún no está implementada (borrador 056 no aplicado). No se simula como contratado.`,
  };
}

export function resolveCreatePharmacyRoute(
  planCode: CommercialOnboardingPlanCode
):
  | {
      ok: true;
      rpc: typeof COMMERCIAL_PREP_RPC;
      startsClock: false;
    }
  | {
      ok: false;
      error: string;
      code: 'plan_not_creatable';
    } {
  const availability = modalityAvailability(planCode);
  if (!availability.creatable) {
    return {
      ok: false,
      error: `El plan «${availability.label}» aún no se puede dar de alta como contratado. Usa Piloto (preparación comercial) o espera la asignación de plan (migración 056).`,
      code: 'plan_not_creatable',
    };
  }

  return {
    ok: true,
    rpc: COMMERCIAL_PREP_RPC,
    startsClock: false,
  };
}

/** Resultado esperado de prep (contrato con RPC 055). */
export function expectedPrepOutcome(): {
  trialStatus: 'ready';
  subscriptionId: null;
  pharmacyStatus: 'pending_setup';
  catalogMode: 'generic';
  clockStarted: false;
  masterCatalogMin: number;
  pilotDaysAfterActivate: number;
} {
  return {
    trialStatus: 'ready',
    subscriptionId: null,
    pharmacyStatus: 'pending_setup',
    catalogMode: 'generic',
    clockStarted: false,
    masterCatalogMin: COMMERCIAL_PILOT_MASTER_CATALOG_COUNT,
    pilotDaysAfterActivate: COMMERCIAL_PILOT_DURATION_DAYS,
  };
}

/** Detecta alta legacy (30d) vs prep comercial a partir de señales de lectura. */
export function classifyPharmacyCommercialShape(input: {
  hasCommercialTrial: boolean;
  commercialTrialStatus: string | null;
  subscriptionStatus: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  genericProductCount: number;
}): {
  shape: 'commercial_prep' | 'commercial_active' | 'legacy_trial_30d' | 'unknown';
  clockStarted: boolean;
  notes: string;
} {
  if (input.hasCommercialTrial) {
    const st = input.commercialTrialStatus;
    if (st === 'ready' || st === 'draft') {
      return {
        shape: 'commercial_prep',
        clockStarted: false,
        notes: 'Piloto comercial preparado; reloj no iniciado.',
      };
    }
    if (st === 'active' || st === 'extended') {
      return {
        shape: 'commercial_active',
        clockStarted: true,
        notes: 'Piloto comercial activo (15d o ampliado).',
      };
    }
  }

  if (
    input.subscriptionStatus === 'trialing' &&
    input.trialStart &&
    input.trialEnd &&
    !input.hasCommercialTrial
  ) {
    const days =
      (new Date(input.trialEnd).getTime() -
        new Date(input.trialStart).getTime()) /
      (1000 * 60 * 60 * 24);
    if (days >= 29 && days <= 31) {
      return {
        shape: 'legacy_trial_30d',
        clockStarted: true,
        notes:
          'Suscripción legacy trialing ~30 días sin pharmacy_commercial_trials (ff_create_pharmacy_v1).',
      };
    }
  }

  return {
    shape: 'unknown',
    clockStarted: Boolean(input.subscriptionStatus === 'trialing'),
    notes: 'No encaja en prep comercial ni trial legacy 30d reconocible.',
  };
}

/**
 * Procedimiento de conversión TEST legacy → piloto comercial.
 * Solo documenta pasos; no ejecuta cambios.
 */
export function buildLegacyToCommercialPilotConversionPlan(input: {
  pharmacyId: string;
  pharmacyName: string;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  trialEnd: string | null;
  membershipInvitedOwner: boolean;
  genericProductCount: number;
}): {
  pharmacyId: string;
  current: Record<string, unknown>;
  proposed: string[];
  prechecks: string[];
  rollback: string[];
  requiresAuthorization: true;
} {
  return {
    pharmacyId: input.pharmacyId,
    requiresAuthorization: true,
    current: {
      name: input.pharmacyName,
      shape: 'legacy_trial_30d',
      subscriptionId: input.subscriptionId,
      subscriptionStatus: input.subscriptionStatus,
      trialEnd: input.trialEnd,
      commercialTrial: null,
      genericProductCount: input.genericProductCount,
      ownerInvited: input.membershipInvitedOwner,
    },
    proposed: [
      '1) Cancelar o expirar SOLO la suscripción legacy de esta farmacia (status cancelled/expired) sin tocar otras.',
      '2) Insertar pharmacy_commercial_trials (program commercial_v1_15d, status ready, prepared_at=now, activated_at/ends_at NULL).',
      '3) Aplicar perfil entitlements piloto + ff_attach_master_catalog_v1 (≈100 genéricos).',
      '4) Asegurar pharmacy_assistant_settings; catalog_mode=generic.',
      '5) NO llamar ff_commercial_trial_activate_v1 hasta readiness (owner active + checklist).',
      '6) Mantener membership invited del propietario; completar vía Reenviar + first-access (no forzar active).',
    ],
    prechecks: [
      'Confirmación explícita de autorización escrita para esta pharmacy_id.',
      'Backup/snapshot staging de subscriptions + pharmacy_commercial_trials + pharmacy_products (esta farmacia).',
      'Verificar que no exista ya commercial trial abierta para la farmacia.',
      'Verificar membership OWNER invited/active no se altera en el paso de suscripción/catálogo.',
      'Readiness post-cambio: trial_ready=true, no_current_subscription=true, generic≥100; owner_active según estado real.',
    ],
    rollback: [
      'Restaurar fila subscriptions al estado trialing/fechas previas desde backup.',
      'DELETE pharmacy_commercial_trials de esta farmacia si se insertó en la conversión.',
      'Revertir productos genéricos adjuntos solo si el backup lo permite (o soft-deactivate source ff_master_v1).',
      'No revertir Auth users ni passwords.',
    ],
  };
}
