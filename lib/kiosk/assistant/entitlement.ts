import { createClient } from '@/lib/supabase/server';
import {
  assistantModuleCurrentlyUsable,
  parseAssistantEntitlementRow,
  resolveAssistantCommercialUiState,
  type AssistantCommercialUiState,
  type AssistantEntitlementRecord,
} from '@/lib/kiosk/assistant/entitlement-status';

export type PharmacyAssistantEntitlementView = {
  entitlement: AssistantEntitlementRecord | null;
  uiState: AssistantCommercialUiState;
  moduleUsable: boolean;
};

/**
 * Lee el entitlement assistant_ai de una farmacia (RLS).
 */
export async function getPharmacyAssistantEntitlement(
  pharmacyId: string
): Promise<PharmacyAssistantEntitlementView> {
  const empty: PharmacyAssistantEntitlementView = {
    entitlement: null,
    uiState: 'not_contracted',
    moduleUsable: false,
  };

  if (!pharmacyId || !/^[0-9a-f-]{36}$/i.test(pharmacyId)) {
    return empty;
  }

  const supabase = createClient();
  const { data: mod, error: modError } = await supabase
    .from('modules')
    .select('id')
    .eq('key', 'assistant_ai')
    .maybeSingle();

  if (modError) {
    console.error('[assistant] get module', modError.message);
    return empty;
  }
  if (!mod?.id) {
    return empty;
  }

  const { data, error } = await supabase
    .from('pharmacy_entitlements')
    .select('status, source, ends_at, config, limits')
    .eq('pharmacy_id', pharmacyId)
    .eq('module_id', mod.id as string)
    .maybeSingle();

  if (error) {
    console.error('[assistant] get entitlement', error.message);
    return empty;
  }

  if (!data) {
    return empty;
  }

  const entitlement = parseAssistantEntitlementRow({
    status: String(data.status),
    source: String(data.source),
    ends_at: (data.ends_at as string | null) ?? null,
    config: data.config,
    limits: data.limits,
  });

  return {
    entitlement,
    uiState: resolveAssistantCommercialUiState(entitlement),
    moduleUsable: assistantModuleCurrentlyUsable(entitlement),
  };
}
