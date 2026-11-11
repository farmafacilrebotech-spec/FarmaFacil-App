/**
 * Espejo TypeScript de ff_assign_commercial_plan_v1 tras 083.
 * NO aplica SQL. Usado por UI/tests hasta autorización de migrate en prod.
 */

import type { CatalogMode, CommercialPlanCode } from './plan-catalog-mode';

/** Claves en commercial_plan_skus (047). */
export type CommercialSkuKey =
  | 'pilot'
  | 'general'
  | 'personalized'
  | 'ai_personalized';

export type CommercialSkuEffects = {
  catalogMode: CatalogMode;
  /**
   * 083: general/personalizado/asistente_ia_personalizado.
   * pilot sigue en starter. (056 legacy usaba starter/pro/business.)
   */
  technicalPlanKey:
    | 'starter'
    | 'general'
    | 'personalizado'
    | 'asistente_ia_personalizado';
  assistantAction: 'none' | 'activate_demo' | 'activate_contracted';
  attachMaster: boolean;
  isPilot: boolean;
  createsPaidSubscription: boolean;
  expectedCoreModules: readonly string[];
  mustNotEnableAsPlan: readonly string[];
};

export const COMMERCIAL_SKU_EFFECTS: Record<
  CommercialSkuKey,
  CommercialSkuEffects
> = {
  pilot: {
    catalogMode: 'generic',
    technicalPlanKey: 'starter',
    assistantAction: 'none',
    attachMaster: true,
    isPilot: true,
    createsPaidSubscription: false,
    expectedCoreModules: [
      'kernel',
      'pharmacies',
      'users',
      'branding',
      'entrypoint_qr',
      'orders',
    ],
    mustNotEnableAsPlan: ['kiosk', 'assistant_ai'],
  },
  general: {
    catalogMode: 'generic',
    technicalPlanKey: 'general',
    assistantAction: 'none',
    attachMaster: true,
    isPilot: false,
    createsPaidSubscription: true,
    expectedCoreModules: [
      'kernel',
      'pharmacies',
      'users',
      'branding',
      'entrypoint_qr',
      'orders',
    ],
    mustNotEnableAsPlan: ['kiosk', 'assistant_ai'],
  },
  personalized: {
    catalogMode: 'own',
    technicalPlanKey: 'personalizado',
    assistantAction: 'none',
    attachMaster: false,
    isPilot: false,
    createsPaidSubscription: true,
    expectedCoreModules: [
      'kernel',
      'pharmacies',
      'users',
      'branding',
      'entrypoint_qr',
      'orders',
    ],
    mustNotEnableAsPlan: ['kiosk', 'assistant_ai'],
  },
  ai_personalized: {
    catalogMode: 'own',
    technicalPlanKey: 'asistente_ia_personalizado',
    assistantAction: 'activate_contracted',
    attachMaster: false,
    isPilot: false,
    createsPaidSubscription: true,
    expectedCoreModules: [
      'kernel',
      'pharmacies',
      'users',
      'branding',
      'entrypoint_qr',
      'orders',
    ],
    mustNotEnableAsPlan: ['kiosk'],
  },
};

export const ASSIGN_COMMERCIAL_PLAN_RPC = 'ff_assign_commercial_plan_v1' as const;

export const ASSIGN_COMMERCIAL_PLAN_MIGRATION =
  'supabase/migrations/083_commercial_plans_activation_v1.sql' as const;

export const ASSIGN_COMMERCIAL_PLAN_DRAFT =
  'supabase/drafts/056_commercial_plan_assign_catalog_mode_v1.sql' as const;

export function commercialPlanCodeToSkuKey(
  planCode: CommercialPlanCode
): CommercialSkuKey {
  switch (planCode) {
    case 'piloto':
      return 'pilot';
    case 'general':
      return 'general';
    case 'personalizado':
      return 'personalized';
    case 'asistente_ia_personalizado':
      return 'ai_personalized';
    default: {
      const _exhaustive: never = planCode;
      return _exhaustive;
    }
  }
}

export function effectsForPlanCode(
  planCode: CommercialPlanCode
): CommercialSkuEffects {
  return COMMERCIAL_SKU_EFFECTS[commercialPlanCodeToSkuKey(planCode)];
}

export function assertGeneralPlanEffects(effects: CommercialSkuEffects): void {
  if (effects.catalogMode !== 'generic') {
    throw new Error('General debe usar catalog_mode=generic');
  }
  if (effects.technicalPlanKey !== 'general') {
    throw new Error('General debe mapear a plans.key=general (083)');
  }
  if (!effects.attachMaster) {
    throw new Error('General debe adjuntar catálogo maestro');
  }
  if (effects.assistantAction !== 'none') {
    throw new Error(
      'General no debe activar asistente (ni demo ni contracted); assistantAction=none'
    );
  }
}

export function assertPersonalizedPlanEffects(
  effects: CommercialSkuEffects
): void {
  if (effects.catalogMode !== 'own') {
    throw new Error('Personalizado debe usar catalog_mode=own');
  }
  if (effects.technicalPlanKey !== 'personalizado') {
    throw new Error('Personalizado debe mapear a plans.key=personalizado (083)');
  }
  if (effects.attachMaster) {
    throw new Error('Personalizado no debe re-adjuntar maestro al asignar');
  }
  if (effects.assistantAction !== 'none') {
    throw new Error(
      'Personalizado no debe activar asistente; solo ai_personalized'
    );
  }
}
