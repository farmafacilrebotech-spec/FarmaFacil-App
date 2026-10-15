import { createClient } from '@/lib/supabase/server';
import { getPharmacyKioskEntitlement } from '@/lib/kiosk/entitlement';
import { kioskCommercialUiCopy } from '@/lib/kiosk/entitlement-status';
import { getPharmacySubscription } from '@/lib/pharmacies/queries';
import {
  buildTenantSubscriptionSummary,
  type TenantSubscriptionSummary,
} from '@/lib/pharmacies/tenant-subscription-summary';
import type { PlanSummary } from '@/lib/pharmacies/types';

type PlanRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

function mapPlan(raw: PlanRow | PlanRow[] | null | undefined): PlanSummary | null {
  if (!raw) return null;
  const row = Array.isArray(raw) ? raw[0] : raw;
  if (!row?.id) return null;
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    is_active: row.is_active,
    sort_order: row.sort_order,
  };
}

/**
 * Carga resumen comercial tenant (suscripción + add-on kiosk).
 * Solo lectura; no altera estados.
 */
export async function loadTenantSubscriptionSummary(
  pharmacyId: string
): Promise<TenantSubscriptionSummary> {
  const [subscription, kiosk, pharmacyRow] = await Promise.all([
    getPharmacySubscription(pharmacyId),
    getPharmacyKioskEntitlement(pharmacyId),
    createClient()
      .from('pharmacies')
      .select('plan:plans ( id, key, name, description, is_active, sort_order )')
      .eq('id', pharmacyId)
      .maybeSingle(),
  ]);

  const pharmacyPlan = mapPlan(
    (pharmacyRow.data?.plan as PlanRow | PlanRow[] | null | undefined) ?? null
  );
  const kioskCopy = kioskCommercialUiCopy(kiosk.uiState);

  return buildTenantSubscriptionSummary({
    subscription,
    pharmacyPlan,
    kioskAddonLabel: kioskCopy.title,
    kioskAddonDescription: kioskCopy.description,
    kioskEndsAt: kiosk.entitlement?.endsAt ?? null,
  });
}
