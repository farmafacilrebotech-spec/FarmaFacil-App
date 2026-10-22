/**
 * Mapeo plan comercial → modalidad de catálogo (contrato Fase 5).
 * La asignación real de plan/suscripción técnica requiere migración 056 (no aplicada).
 */

export type CommercialPlanCode =
  | 'piloto'
  | 'general'
  | 'personalizado'
  | 'asistente_ia_personalizado';

export type CatalogMode = 'generic' | 'own';

export type PlanCatalogExpectation = {
  planCode: CommercialPlanCode;
  label: string;
  catalogMode: CatalogMode;
  assistantPersonalized: boolean;
  notes: string;
};

export const PLAN_CATALOG_EXPECTATIONS: PlanCatalogExpectation[] = [
  {
    planCode: 'piloto',
    label: 'Piloto',
    catalogMode: 'generic',
    assistantPersonalized: false,
    notes: '15 días (+15 opcional). Reloj solo tras activación explícita.',
  },
  {
    planCode: 'general',
    label: 'General',
    catalogMode: 'generic',
    assistantPersonalized: false,
    notes: 'Catálogo maestro FarmaFácil (100 genéricos). Sin import CSV propio.',
  },
  {
    planCode: 'personalizado',
    label: 'Personalizado',
    catalogMode: 'own',
    assistantPersonalized: false,
    notes: 'Catálogo propio de la farmacia. Pedidos históricos se conservan.',
  },
  {
    planCode: 'asistente_ia_personalizado',
    label: 'Asistente IA personalizado',
    catalogMode: 'own',
    assistantPersonalized: true,
    notes: 'Catálogo own + entitlement de asistente personalizado.',
  },
];

export function expectedCatalogModeForPlan(
  planCode: CommercialPlanCode
): CatalogMode {
  const row = PLAN_CATALOG_EXPECTATIONS.find((p) => p.planCode === planCode);
  return row?.catalogMode ?? 'generic';
}

/**
 * Operaciones de contratación/cambio de plan aún NO existen como RPC única.
 * Documentado en supabase/drafts/056_commercial_plan_assign_catalog_mode_v1.sql
 */
export const PLAN_ASSIGN_RPC_STATUS = {
  exists: false as const,
  draftMigration: 'supabase/drafts/056_commercial_plan_assign_catalog_mode_v1.sql',
  draftRpc: 'ff_assign_commercial_plan_v1' as const,
  interimRpcs: [
    'ff_attach_master_catalog_v1',
    'ff_set_pharmacy_catalog_mode_v1',
    'ff_sync_master_catalog_v1',
  ] as const,
  note:
    'Borrador 056 listo (NO aplicado). Hasta autorizar apply, la UI alinea solo catalog_mode vía RPCs interim.',
};
