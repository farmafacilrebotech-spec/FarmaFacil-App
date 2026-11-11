/**
 * Fuente única de planes comerciales vigentes (UI).
 * No inventa filas en `plans`. Precios lista/promo separados del plan técnico.
 */
import {
  APPROVED_COMMERCIAL_PLAN_LABELS,
  commercialPlanLabel,
  LEGACY_KERNEL_PLAN_LABELS,
} from '@/lib/commercial/commercial-plan-labels';
import { PLAN_CATALOG_EXPECTATIONS } from '@/lib/commercial/plan-catalog-mode';
import type { PlanSummary } from '@/lib/pharmacies/types';
import {
  LAUNCH_2027_PROMO_MONTHLY_CENTS,
  LIST_MONTHLY_CENTS,
  annualPrepaidCents,
  formatEurFromCents,
  plansKeyToPaidSku,
  type PaidCommercialSku,
} from '@/lib/pharmacies/commercial-assign-pricing';

export { commercialPlanLabel };

/** Claves comerciales aprobadas (producto FarmaFácil / plans.key). */
export const COMMERCIAL_PLAN_KEYS = [
  'general',
  'personalizado',
  'asistente_ia_personalizado',
] as const;

export type CommercialPlanKey = (typeof COMMERCIAL_PLAN_KEYS)[number];

const COMMERCIAL_KEY_ALIASES: Record<string, CommercialPlanKey> = {
  general: 'general',
  personalizado: 'personalizado',
  personalized: 'personalizado',
  asistente_ia_personalizado: 'asistente_ia_personalizado',
  ai_personalized: 'asistente_ia_personalizado',
  ia: 'asistente_ia_personalizado',
};

const LEGACY_KEYS = new Set(
  ['starter', 'pro', 'business', 'enterprise'].map((k) => k.toLowerCase())
);

export function normalizeCommercialPlanKey(
  key: string | null | undefined
): CommercialPlanKey | null {
  if (!key) return null;
  return COMMERCIAL_KEY_ALIASES[key.trim().toLowerCase()] ?? null;
}

export function isLegacyKernelPlanKey(key: string | null | undefined): boolean {
  if (!key) return false;
  const k = key.trim().toLowerCase();
  if (LEGACY_KEYS.has(k)) return true;
  return (LEGACY_KERNEL_PLAN_LABELS as readonly string[]).some(
    (l) => l.toLowerCase() === k
  );
}

export type SelectablePlanOption = {
  assignKey: string;
  label: string;
  description: string;
  kind: 'commercial' | 'legacy' | 'other';
  assignable: boolean;
  planId: string | null;
  sku?: PaidCommercialSku;
  listMonthlyLabel?: string;
  promoMonthlyLabel?: string;
  annualListLabel?: string;
};

export function buildChangePlanOptions(
  dbPlans: PlanSummary[]
): SelectablePlanOption[] {
  const byKey = new Map(
    dbPlans.map((p) => [p.key.trim().toLowerCase(), p] as const)
  );

  const options: SelectablePlanOption[] = [];

  for (const expectation of PLAN_CATALOG_EXPECTATIONS) {
    if (expectation.planCode === 'piloto') continue;
    const commercialKey = expectation.planCode as CommercialPlanKey;
    const aliases = Object.entries(COMMERCIAL_KEY_ALIASES)
      .filter(([, v]) => v === commercialKey)
      .map(([k]) => k);
    const match =
      aliases.map((a) => byKey.get(a)).find(Boolean) ??
      byKey.get(commercialKey) ??
      null;
    const sku = plansKeyToPaidSku(match?.key ?? commercialKey);
    const listCents = sku ? LIST_MONTHLY_CENTS[sku] : null;
    const promoCents = sku ? LAUNCH_2027_PROMO_MONTHLY_CENTS[sku] : null;

    options.push({
      assignKey: match?.key ?? commercialKey,
      label:
        expectation.label === 'Asistente IA personalizado'
          ? APPROVED_COMMERCIAL_PLAN_LABELS.asistente_ia_personalizado
          : expectation.label,
      description: match
        ? match.description || expectation.notes
        : `${expectation.notes} · Pendiente de fila técnica en catálogo (no se puede asignar aún).`,
      kind: 'commercial',
      assignable: Boolean(match?.is_active),
      planId: match?.id ?? null,
      sku: sku ?? undefined,
      listMonthlyLabel: listCents != null ? formatEurFromCents(listCents) : undefined,
      promoMonthlyLabel:
        promoCents != null ? formatEurFromCents(promoCents) : undefined,
      annualListLabel:
        listCents != null
          ? formatEurFromCents(annualPrepaidCents(listCents))
          : undefined,
    });
  }

  for (const plan of dbPlans) {
    const commercial = normalizeCommercialPlanKey(plan.key);
    if (commercial) continue;
    const legacy = isLegacyKernelPlanKey(plan.key);
    options.push({
      assignKey: plan.key,
      label: commercialPlanLabel(plan.key),
      description: legacy
        ? `${plan.description || plan.name} · Plan legacy interno; no es la oferta comercial vigente.`
        : plan.description || plan.name,
      kind: legacy ? 'legacy' : 'other',
      assignable: plan.is_active,
      planId: plan.id,
    });
  }

  return options;
}
