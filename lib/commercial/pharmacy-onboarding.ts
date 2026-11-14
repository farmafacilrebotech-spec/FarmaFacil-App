/**
 * Alta comercial SuperAdmin — reglas de negocio (sin I/O).
 *
 * - Alta limpia → ff_create_pharmacy_v1 (091: sin trial).
 * - Piloto → prep comercial + activate con plan G/P/IA (095).
 * - Contratación → ff_assign_commercial_plan_v1 (083), sin plaza automática (093).
 */

/** Días del piloto tras activación explícita. */
export const COMMERCIAL_PILOT_DURATION_DAYS = 15;

export const COMMERCIAL_PILOT_MASTER_CATALOG_COUNT = 100;

export const COMMERCIAL_PREP_RPC = 'ff_create_pharmacy_commercial_prep_v1' as const;

export const CLEAN_CREATE_PHARMACY_RPC = 'ff_create_pharmacy_v1' as const;

/** @deprecated alias histórico */
export const LEGACY_CREATE_PHARMACY_RPC = CLEAN_CREATE_PHARMACY_RPC;

export const PLAN_ASSIGN_RPC = 'ff_assign_commercial_plan_v1' as const;

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
  piloto: 'Piloto (acceso temporal)',
  general: 'General',
  personalizado: 'Personalizado',
  asistente_ia_personalizado: 'Asistente IA personalizado',
};

export type OnboardingModalityAvailability =
  | {
      planCode: 'piloto';
      label: string;
      creatable: true;
      createVia: typeof COMMERCIAL_PREP_RPC;
      startsClock: false;
      attachesMasterCatalog: true;
      expectedCatalogCount: typeof COMMERCIAL_PILOT_MASTER_CATALOG_COUNT;
      summary: string;
    }
  | {
      planCode: Exclude<CommercialOnboardingPlanCode, 'piloto'>;
      label: string;
      creatable: true;
      createVia: typeof PLAN_ASSIGN_RPC;
      startsClock: false;
      attachesMasterCatalog: boolean;
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
        'Prepara piloto 15 días (ready). El plan de prueba (G/P/IA) se elige al activar. Sin suscripción de pago ni plaza automática.',
    };
  }

  return {
    planCode,
    label,
    creatable: true,
    createVia: PLAN_ASSIGN_RPC,
    startsClock: false,
    attachesMasterCatalog: planCode === 'general',
    summary: `${label}: asignación vía ${PLAN_ASSIGN_RPC}. No reserva plaza ni finaliza pilotos sin confirmación explícita.`,
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
      code: 'use_assign_not_create';
    } {
  if (planCode === 'piloto') {
    return {
      ok: true,
      rpc: COMMERCIAL_PREP_RPC,
      startsClock: false,
    };
  }
  return {
    ok: false,
    error: `«${LABELS[planCode]}» no se crea como alta piloto. Crea la farmacia (alta limpia o piloto) y asigna el plan en Contratación / ficha.`,
    code: 'use_assign_not_create',
  };
}

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

export function classifyPharmacyCommercialShape(input: {
  hasCommercialTrial: boolean;
  commercialTrialStatus: string | null;
  subscriptionStatus: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  genericProductCount: number;
}): {
  shape:
    | 'commercial_prep'
    | 'commercial_active'
    | 'legacy_trial_30d'
    | 'clean_pending'
    | 'unknown';
  clockStarted: boolean;
  notes: string;
} {
  if (
    !input.hasCommercialTrial &&
    (input.subscriptionStatus == null ||
      input.subscriptionStatus === '' ||
      input.subscriptionStatus === 'cancelled' ||
      input.subscriptionStatus === 'expired')
  ) {
    return {
      shape: 'clean_pending',
      clockStarted: false,
      notes:
        'Pendiente de activación comercial (sin trial 30d ni piloto activo).',
    };
  }

  if (input.hasCommercialTrial) {
    const st = input.commercialTrialStatus;
    if (st === 'ready' || st === 'draft') {
      return {
        shape: 'commercial_prep',
        clockStarted: false,
        notes: 'Piloto preparado; reloj no iniciado.',
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
        notes: 'Suscripción legacy trialing ~30 días (pre-091).',
      };
    }
  }

  return {
    shape: 'unknown',
    clockStarted: false,
    notes: 'Forma comercial no clasificada.',
  };
}

export function buildPostPrepChecklist(): {
  title: string;
  proposed: string[];
} {
  return {
    title: 'Tras preparación de piloto',
    proposed: [
      '1) Invitar titular OWNER y esperar membership active.',
      '2) Verificar catálogo genérico (≥100).',
      '3) Comprobar preparación (antes Readiness).',
      '4) Activar piloto eligiendo plan G / Personalizado / Asistente IA.',
      '5) No reservar plaza ni cobrar automáticamente.',
    ],
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
      '5) NO llamar ff_commercial_trial_activate_v1 hasta comprobar preparación (owner active + checklist).',
      '6) Mantener membership invited del propietario; completar vía Reenviar + first-access (no forzar active).',
    ],
    prechecks: [
      'Confirmación explícita de autorización escrita para esta pharmacy_id.',
      'Backup/snapshot staging de subscriptions + pharmacy_commercial_trials + pharmacy_products (esta farmacia).',
      'Verificar que no exista ya commercial trial abierta para la farmacia.',
      'Verificar membership OWNER invited/active no se altera en el paso de suscripción/catálogo.',
      'Comprobar preparación post-cambio: trial_ready=true, no_current_subscription=true, generic≥100.',
    ],
    rollback: [
      'Restaurar fila subscriptions al estado trialing/fechas previas desde backup.',
      'DELETE pharmacy_commercial_trials de esta farmacia si se insertó en la conversión.',
      'Revertir productos genéricos adjuntos solo si el backup lo permite (o soft-deactivate source ff_master_v1).',
      'No revertir Auth users ni passwords.',
    ],
  };
}
