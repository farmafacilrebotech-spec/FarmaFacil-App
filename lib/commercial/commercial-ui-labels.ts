/**
 * Etiquetas en castellano para estados comerciales (IDs internos intactos).
 */

import { commercialPlanLabel } from './commercial-plan-labels.ts';

export const TRIAL_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  ready: 'Preparado',
  active: 'Activo',
  extended: 'Ampliado',
  ended: 'Finalizado',
  converted: 'Convertido en cliente',
  cancelled: 'Cancelado',
};

export const PHARMACY_STATUS_LABELS: Record<string, string> = {
  pending_setup: 'En preparación',
  active: 'Activa',
  suspended: 'Suspendida',
  archived: 'Archivada',
};

export const CATALOG_MODE_LABELS: Record<string, string> = {
  generic: 'Catálogo genérico FarmaFácil',
  own: 'Catálogo propio',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  trialing: 'Periodo de prueba',
  active: 'Activa',
  past_due: 'Pago pendiente',
  paused: 'Pausada',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

export function trialStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return TRIAL_STATUS_LABELS[status] ?? status;
}

export function pharmacyStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  return PHARMACY_STATUS_LABELS[status] ?? status;
}

export function catalogModeLabel(mode: string | null | undefined): string {
  if (!mode) return '—';
  return CATALOG_MODE_LABELS[mode] ?? mode;
}

export function subscriptionStatusLabel(
  status: string | null | undefined
): string {
  if (!status) return '—';
  return SUBSCRIPTION_STATUS_LABELS[status] ?? status;
}

/** Cabecera ficha: plan en prueba si hay trial abierto; si no, plan comercial. */
export function pharmacyPlanDisplayLabel(input: {
  openTrialSku?: string | null;
  openTrialStatus?: string | null;
  planKey?: string | null;
  planName?: string | null;
}): string {
  const open = ['ready', 'active', 'extended'].includes(
    String(input.openTrialStatus || '')
  );
  if (open && input.openTrialSku) {
    return `En prueba · ${commercialPlanLabel(input.openTrialSku)}`;
  }
  if (input.planKey) {
    const labeled = commercialPlanLabel(input.planKey);
    if (!/legacy interno/i.test(labeled)) return labeled;
  }
  // Evitar Starter/Pro crudos en UI comercial
  const raw = input.planName || input.planKey || '—';
  if (/^(starter|pro|business|enterprise)$/i.test(String(raw))) {
    return `${raw} (legacy interno)`;
  }
  return String(raw);
}

export const VISIBLE_TRIAL_PLAN_OPTIONS = [
  { value: 'general' as const, label: commercialPlanLabel('general') },
  {
    value: 'personalized' as const,
    label: commercialPlanLabel('personalized'),
  },
  {
    value: 'ai_personalized' as const,
    label: commercialPlanLabel('ai_personalized'),
  },
];
