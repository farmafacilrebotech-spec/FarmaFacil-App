/**
 * Resumen comercial de solo lectura para OWNER/ADMIN en el panel tenant.
 * Sin controles SuperAdmin ni datos de facturación inventados.
 * Puro: testeable sin BD / sin path aliases.
 */

import type {
  PharmacyRoleKey,
  PharmacySubscription,
  PlanSummary,
} from './types';

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  trialing: 'Periodo de prueba',
  active: 'Activa',
  past_due: 'Pago atrasado',
  paused: 'Pausada',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

export type TenantSubscriptionSummary = {
  planName: string | null;
  subscriptionStatus: string | null;
  subscriptionStatusLabel: string | null;
  trialEnd: string | null;
  /** Renovación o fin de periodo, si existe. */
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** Etiqueta del add-on Kiosko (estado comercial). */
  kioskAddonLabel: string;
  kioskAddonDescription: string;
  kioskEndsAt: string | null;
};

export function canViewTenantSubscriptionSummary(
  roleKey: PharmacyRoleKey | string
): boolean {
  return roleKey === 'PHARMACY_OWNER' || roleKey === 'PHARMACY_ADMIN';
}

export function buildTenantSubscriptionSummary(input: {
  subscription: PharmacySubscription | null;
  pharmacyPlan: PlanSummary | null;
  kioskAddonLabel: string;
  kioskAddonDescription: string;
  kioskEndsAt: string | null;
}): TenantSubscriptionSummary {
  const sub = input.subscription;
  const planName = sub?.plan?.name ?? input.pharmacyPlan?.name ?? null;
  const status = sub?.status ?? null;

  return {
    planName,
    subscriptionStatus: status,
    subscriptionStatusLabel: status
      ? SUBSCRIPTION_STATUS_LABELS[status] ?? status
      : null,
    trialEnd: sub?.trial_end ?? null,
    periodEnd: sub?.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(sub?.cancel_at_period_end),
    kioskAddonLabel: input.kioskAddonLabel,
    kioskAddonDescription: input.kioskAddonDescription,
    kioskEndsAt: input.kioskEndsAt,
  };
}
