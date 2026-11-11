/**
 * Precios lista / promo launch 2027 (céntimos). Espejo de 084.
 * Separado del plan técnico contratado.
 */

export const LIST_MONTHLY_CENTS = {
  general: 9750,
  personalized: 17250,
  ai_personalized: 24750,
} as const;

export const LAUNCH_2027_PROMO_MONTHLY_CENTS = {
  general: 3900,
  personalized: 6900,
  ai_personalized: 9900,
} as const;

export const LAUNCH_2027_MAX_SLOTS = 20;
export const SAAS_ANNUAL_DISCOUNT_BPS = 1500; // 15 %

export type PaidCommercialSku = keyof typeof LIST_MONTHLY_CENTS;

export function plansKeyToPaidSku(planKey: string): PaidCommercialSku | null {
  const k = planKey.trim().toLowerCase();
  if (k === 'general') return 'general';
  if (k === 'personalizado' || k === 'personalized') return 'personalized';
  if (
    k === 'asistente_ia_personalizado' ||
    k === 'ai_personalized' ||
    k === 'ia'
  ) {
    return 'ai_personalized';
  }
  return null;
}

export function formatEurFromCents(cents: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function annualPrepaidCents(
  monthlyCents: number,
  annualDiscountBps = SAAS_ANNUAL_DISCOUNT_BPS
): number {
  const exact = Math.round((monthlyCents * 12 * (10000 - annualDiscountBps)) / 10000);
  return Math.round(exact / 100) * 100;
}
