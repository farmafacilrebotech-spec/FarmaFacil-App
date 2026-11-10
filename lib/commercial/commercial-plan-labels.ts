/**
 * Nombres comerciales aprobados vs claves internas / legacy kernel.
 * No modifica importes ni suscripciones.
 */

export const APPROVED_COMMERCIAL_PLAN_LABELS = {
  piloto: 'Piloto',
  general: 'General',
  personalizado: 'Personalizado',
  asistente_ia_personalizado: 'IA',
} as const;

/** Legacy seed plans (005) — no usar en UI comercial. */
export const LEGACY_KERNEL_PLAN_LABELS = [
  'Starter',
  'Pro',
  'Business',
  'Enterprise',
] as const;

export function commercialPlanLabel(planCode: string | null | undefined): string {
  if (!planCode) return '—';
  const key = planCode.trim().toLowerCase();
  const map: Record<string, string> = {
    piloto: APPROVED_COMMERCIAL_PLAN_LABELS.piloto,
    pilot: APPROVED_COMMERCIAL_PLAN_LABELS.piloto,
    general: APPROVED_COMMERCIAL_PLAN_LABELS.general,
    personalizado: APPROVED_COMMERCIAL_PLAN_LABELS.personalizado,
    personalized: APPROVED_COMMERCIAL_PLAN_LABELS.personalizado,
    asistente_ia_personalizado:
      APPROVED_COMMERCIAL_PLAN_LABELS.asistente_ia_personalizado,
    ai_personalized: APPROVED_COMMERCIAL_PLAN_LABELS.asistente_ia_personalizado,
    ia: APPROVED_COMMERCIAL_PLAN_LABELS.asistente_ia_personalizado,
  };
  if (map[key]) return map[key];
  // No inventar Starter/Business como comerciales
  if (
    (LEGACY_KERNEL_PLAN_LABELS as readonly string[]).some(
      (l) => l.toLowerCase() === key
    )
  ) {
    return `${planCode} (legacy interno)`;
  }
  return planCode;
}
