/**
 * Reglas comerciales FarmaFácil (espejo de SQL 027–029).
 * Fuente de enforcement: RLS + ff_pharmacy_is_operable en Postgres.
 * Este módulo documenta y prueba las transiciones sin tocar la BD.
 */

export const TRIAL_DAYS = 30;
export const NONPAYMENT_GRACE_DAYS = 7;

export type CommercialAction =
  | 'cancel_at_period_end'
  | 'cancel_now'
  | 'start_nonpayment_grace'
  | 'suspend_for_nonpayment'
  | 'reactivate';

export type CommercialPharmacyStatus =
  | 'draft'
  | 'pending_contract'
  | 'contract_sent'
  | 'contract_signed'
  | 'pending_setup'
  | 'active'
  | 'suspended'
  | 'archived';

export type CommercialSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'cancelled'
  | 'expired';

export type CommercialSnapshot = {
  pharmacyStatus: CommercialPharmacyStatus;
  subscriptionStatus: CommercialSubscriptionStatus;
  trialEnd?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  gracePeriodEndsAt?: string | null;
  now?: Date;
};

export type OperabilityResult = {
  operable: boolean;
  reason:
    | 'ok'
    | 'pharmacy_suspended'
    | 'pharmacy_archived'
    | 'subscription_paused'
    | 'subscription_cancelled'
    | 'subscription_expired'
    | 'trial_ended'
    | 'period_ended_after_cancel'
    | 'grace_ended'
    | 'no_valid_subscription';
};

function at(snapshot: CommercialSnapshot): Date {
  return snapshot.now ?? new Date();
}

function isAfter(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() <= now.getTime();
}

/** Espejo de ff_pharmacy_subscription_is_valid + eje farmacia. */
export function evaluatePharmacyOperability(
  snapshot: CommercialSnapshot
): OperabilityResult {
  const now = at(snapshot);

  if (snapshot.pharmacyStatus === 'suspended') {
    return { operable: false, reason: 'pharmacy_suspended' };
  }
  if (snapshot.pharmacyStatus === 'archived') {
    return { operable: false, reason: 'pharmacy_archived' };
  }

  const status = snapshot.subscriptionStatus;

  if (status === 'paused') {
    return { operable: false, reason: 'subscription_paused' };
  }
  if (status === 'cancelled') {
    return { operable: false, reason: 'subscription_cancelled' };
  }
  if (status === 'expired') {
    return { operable: false, reason: 'subscription_expired' };
  }

  if (status === 'trialing') {
    // Alineado con SQL: trial_end obligatorio y futuro
    if (!snapshot.trialEnd) {
      return { operable: false, reason: 'trial_ended' };
    }
    if (isAfter(snapshot.trialEnd, now)) {
      return { operable: false, reason: 'trial_ended' };
    }
    return { operable: true, reason: 'ok' };
  }

  if (status === 'active') {
    if (snapshot.cancelAtPeriodEnd === true) {
      if (!snapshot.currentPeriodEnd) {
        return { operable: false, reason: 'period_ended_after_cancel' };
      }
      if (isAfter(snapshot.currentPeriodEnd, now)) {
        return { operable: false, reason: 'period_ended_after_cancel' };
      }
    }
    return { operable: true, reason: 'ok' };
  }

  if (status === 'past_due') {
    if (!snapshot.gracePeriodEndsAt) {
      return { operable: false, reason: 'grace_ended' };
    }
    if (isAfter(snapshot.gracePeriodEndsAt, now)) {
      return { operable: false, reason: 'grace_ended' };
    }
    return { operable: true, reason: 'ok' };
  }

  return { operable: false, reason: 'no_valid_subscription' };
}

export type TransitionValidation =
  | { ok: true }
  | { ok: false; error: string };

/** Validación previa (espejo de guards de ff_transition_pharmacy_subscription_v1). */
export function validateCommercialTransition(
  action: CommercialAction,
  snapshot: CommercialSnapshot
): TransitionValidation {
  const now = at(snapshot);
  const sub = snapshot.subscriptionStatus;
  const pharmacy = snapshot.pharmacyStatus;

  switch (action) {
    case 'cancel_at_period_end': {
      if (sub !== 'trialing' && sub !== 'active') {
        return {
          ok: false,
          error:
            'Solo se puede programar la cancelación con suscripción en prueba o activa.',
        };
      }
      const end =
        sub === 'trialing'
          ? snapshot.trialEnd ?? snapshot.currentPeriodEnd
          : snapshot.currentPeriodEnd;
      if (!end || new Date(end).getTime() <= now.getTime()) {
        return {
          ok: false,
          error:
            'No hay fecha de fin de periodo válida. Usa cancelación inmediata o define el periodo.',
        };
      }
      return { ok: true };
    }
    case 'cancel_now': {
      if (sub === 'cancelled' || sub === 'expired') {
        return { ok: false, error: 'La suscripción ya está finalizada.' };
      }
      return { ok: true };
    }
    case 'start_nonpayment_grace': {
      if (sub !== 'trialing' && sub !== 'active' && sub !== 'past_due') {
        return {
          ok: false,
          error:
            'Solo se puede iniciar gracia desde prueba, activa o ya en past_due.',
        };
      }
      if (pharmacy === 'suspended') {
        return {
          ok: false,
          error:
            'La farmacia ya está suspendida. Usa reactivar o deja la suspensión.',
        };
      }
      return { ok: true };
    }
    case 'suspend_for_nonpayment': {
      if (pharmacy === 'archived') {
        return {
          ok: false,
          error: 'No se puede suspender una farmacia archivada.',
        };
      }
      return { ok: true };
    }
    case 'reactivate': {
      if (pharmacy === 'archived') {
        return {
          ok: false,
          error:
            'No se puede reactivar comercialmente una farmacia archivada.',
        };
      }
      const can =
        sub === 'past_due' ||
        sub === 'paused' ||
        sub === 'cancelled' ||
        sub === 'expired' ||
        pharmacy === 'suspended' ||
        snapshot.cancelAtPeriodEnd === true;
      if (!can) {
        return {
          ok: false,
          error: 'No hay estado comercial o de farmacia que reactivar.',
        };
      }
      return { ok: true };
    }
    default:
      return { ok: false, error: 'Acción comercial no reconocida.' };
  }
}

/** Efecto esperado post-transición (para tests; no muta BD). */
export function projectCommercialTransition(
  action: CommercialAction,
  snapshot: CommercialSnapshot
): CommercialSnapshot {
  const now = at(snapshot);
  const validation = validateCommercialTransition(action, snapshot);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  switch (action) {
    case 'cancel_at_period_end':
      return { ...snapshot, cancelAtPeriodEnd: true };
    case 'cancel_now':
      return {
        ...snapshot,
        subscriptionStatus: 'cancelled',
        cancelAtPeriodEnd: false,
        gracePeriodEndsAt: null,
      };
    case 'start_nonpayment_grace': {
      const grace = new Date(now);
      grace.setUTCDate(grace.getUTCDate() + NONPAYMENT_GRACE_DAYS);
      return {
        ...snapshot,
        subscriptionStatus: 'past_due',
        cancelAtPeriodEnd: false,
        gracePeriodEndsAt: grace.toISOString(),
      };
    }
    case 'suspend_for_nonpayment':
      return {
        ...snapshot,
        pharmacyStatus: 'suspended',
        subscriptionStatus:
          snapshot.subscriptionStatus === 'cancelled' ||
          snapshot.subscriptionStatus === 'expired'
            ? snapshot.subscriptionStatus
            : 'past_due',
        gracePeriodEndsAt: now.toISOString(),
      };
    case 'reactivate': {
      const periodEnd = new Date(now);
      periodEnd.setUTCDate(periodEnd.getUTCDate() + TRIAL_DAYS);
      return {
        ...snapshot,
        pharmacyStatus:
          snapshot.pharmacyStatus === 'suspended'
            ? 'active'
            : snapshot.pharmacyStatus,
        subscriptionStatus: 'active',
        cancelAtPeriodEnd: false,
        gracePeriodEndsAt: null,
        currentPeriodEnd: periodEnd.toISOString(),
      };
    }
  }
}

export function addDaysIso(from: Date, days: number): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

const COMMERCIAL_ACTION_ORDER: CommercialAction[] = [
  'cancel_at_period_end',
  'cancel_now',
  'start_nonpayment_grace',
  'suspend_for_nonpayment',
  'reactivate',
];

export const COMMERCIAL_ACTION_LABELS: Record<CommercialAction, string> = {
  cancel_at_period_end: 'Cancelar al finalizar el periodo',
  cancel_now: 'Cancelar inmediatamente',
  start_nonpayment_grace: 'Registrar impago (7 días de gracia)',
  suspend_for_nonpayment: 'Suspender por impago',
  reactivate: 'Reactivar suscripción',
};

export const COMMERCIAL_ACTION_SUCCESS: Record<CommercialAction, string> = {
  cancel_at_period_end:
    'Cancelación programada: el acceso se mantendrá hasta el fin del periodo.',
  cancel_now: 'Suscripción cancelada de inmediato. El acceso operativo queda bloqueado.',
  start_nonpayment_grace:
    'Impago registrado. La farmacia conserva acceso durante 7 días de gracia.',
  suspend_for_nonpayment:
    'Farmacia suspendida por impago. Los datos se conservan; el acceso operativo está bloqueado.',
  reactivate: 'Suscripción reactivada. El acceso operativo queda restablecido.',
};

export function commercialActionRequiresConfirm(
  action: CommercialAction
): boolean {
  return action === 'cancel_now' || action === 'suspend_for_nonpayment';
}

/** Acciones válidas para el estado actual (UI SuperAdmin). */
export function listVisibleCommercialActions(
  snapshot: CommercialSnapshot
): CommercialAction[] {
  return COMMERCIAL_ACTION_ORDER.filter(
    (action) => validateCommercialTransition(action, snapshot).ok
  );
}

export function snapshotFromPharmacyDetail(input: {
  pharmacyStatus: CommercialPharmacyStatus | string;
  subscriptionStatus?: CommercialSubscriptionStatus | string | null;
  trialEnd?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  gracePeriodEndsAt?: string | null;
  now?: Date;
}): CommercialSnapshot | null {
  if (!input.subscriptionStatus) return null;
  return {
    pharmacyStatus: input.pharmacyStatus as CommercialPharmacyStatus,
    subscriptionStatus: input.subscriptionStatus as CommercialSubscriptionStatus,
    trialEnd: input.trialEnd ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    gracePeriodEndsAt: input.gracePeriodEndsAt ?? null,
    now: input.now,
  };
}
