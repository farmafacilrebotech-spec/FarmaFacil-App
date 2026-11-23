/**
 * SKUs comerciales seleccionables en UI SuperAdmin (Tarifas · pilotos y contratación).
 *
 * Un SKU es seleccionable solo si:
 *  - existe y está activo en commercial_plan_skus (si la lectura fue posible), y
 *  - su plan técnico (plans.key) existe y está activo.
 *
 * No borra ni oculta filas históricas: solo filtra opciones de NUEVA asignación.
 */

import type { CommercialSkuKey } from './commercial-plan-assign';

/**
 * SKU → plans.key técnico (espejo de COMMERCIAL_SKU_EFFECTS.technicalPlanKey;
 * duplicado aquí para mantener este módulo sin dependencias de valor).
 */
const SKU_TECHNICAL_PLAN_KEY: Record<CommercialSkuKey, string> = {
  pilot: 'starter',
  general: 'general',
  personalized: 'personalizado',
  ai_personalized: 'asistente_ia_personalizado',
};

export const PAID_COMMERCIAL_SKU_KEYS = [
  'general',
  'personalized',
  'ai_personalized',
] as const satisfies readonly CommercialSkuKey[];

export type PaidCommercialSkuKey = (typeof PAID_COMMERCIAL_SKU_KEYS)[number];

export type CommercialSkuRow = { key: string; is_active: boolean };

/**
 * @param skuRows filas de commercial_plan_skus; null si no se pudo leer (se valida solo plan técnico).
 * @param activeTechnicalPlanKeys plans.key con is_active = true.
 */
export function computeAvailableSkuKeys(input: {
  skuRows: readonly CommercialSkuRow[] | null;
  activeTechnicalPlanKeys: readonly string[];
}): CommercialSkuKey[] {
  const techKeys = new Set(
    input.activeTechnicalPlanKeys.map((k) => k.trim().toLowerCase())
  );
  const activeSkus = input.skuRows
    ? new Set(
        input.skuRows
          .filter((r) => r.is_active)
          .map((r) => r.key.trim().toLowerCase())
      )
    : null;

  const keys = Object.keys(SKU_TECHNICAL_PLAN_KEY) as CommercialSkuKey[];
  return keys.filter((sku) => {
    if (activeSkus && !activeSkus.has(sku)) return false;
    const tech = SKU_TECHNICAL_PLAN_KEY[sku];
    return techKeys.has(tech);
  });
}

export function isPaidSkuAvailable(
  available: readonly string[] | null | undefined,
  sku: PaidCommercialSkuKey
): boolean {
  // null/undefined = sin información (compatibilidad): no filtrar.
  if (!available) return true;
  return available.includes(sku);
}
