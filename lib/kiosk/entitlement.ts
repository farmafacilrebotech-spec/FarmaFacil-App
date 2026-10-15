import { createClient } from '@/lib/supabase/server';
import type { KioskEntitlementRecord } from '@/lib/kiosk/entitlement-status';
import {
  kioskModuleCurrentlyUsable,
  resolveKioskCommercialUiState,
  type KioskCommercialUiState,
} from '@/lib/kiosk/entitlement-status';

export type PharmacyKioskEntitlementView = {
  entitlement: KioskEntitlementRecord | null;
  uiState: KioskCommercialUiState;
  moduleUsable: boolean;
};

/**
 * Lee el entitlement kiosk de una farmacia (RLS: miembro, pharmacies.read o entitlements.manage).
 */
export async function getPharmacyKioskEntitlement(
  pharmacyId: string
): Promise<PharmacyKioskEntitlementView> {
  const empty: PharmacyKioskEntitlementView = {
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
    .eq('key', 'kiosk')
    .maybeSingle();

  if (modError) {
    console.error('[kiosk] get module', modError.message);
    return empty;
  }
  if (!mod?.id) {
    return empty;
  }

  const { data, error } = await supabase
    .from('pharmacy_entitlements')
    .select('status, source, ends_at')
    .eq('pharmacy_id', pharmacyId)
    .eq('module_id', mod.id as string)
    .maybeSingle();

  if (error) {
    console.error('[kiosk] get entitlement', error.message);
    return empty;
  }

  if (!data) {
    return empty;
  }

  const entitlement: KioskEntitlementRecord = {
    status: data.status as KioskEntitlementRecord['status'],
    source: data.source as KioskEntitlementRecord['source'],
    endsAt: (data.ends_at as string | null) ?? null,
  };

  return {
    entitlement,
    uiState: resolveKioskCommercialUiState(entitlement),
    moduleUsable: kioskModuleCurrentlyUsable(entitlement),
  };
}
