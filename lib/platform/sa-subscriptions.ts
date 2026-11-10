/**
 * Suscripciones (facturación/servicio) — lectura SuperAdmin.
 * Distinto de contratos legales PDF (069 pendiente).
 */

import { createClient } from '@/lib/supabase/server';
import { hasPlatformPermission } from '@/lib/auth/platform';
import { commercialPlanLabel } from '@/lib/commercial/commercial-plan-labels';

export type SaSubscriptionRow = {
  id: string;
  pharmacyId: string;
  pharmacyName: string | null;
  status: string;
  planName: string | null;
  planLabel: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
};

export async function listSaSubscriptions(limit = 100): Promise<
  | { ok: true; rows: SaSubscriptionRow[] }
  | { ok: false; error: string }
> {
  const read = await hasPlatformPermission('platform.pharmacies.read');
  if (!read.ok) {
    return { ok: false, error: 'Sin permiso para consultar suscripciones.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('subscriptions')
    .select(
      `
      id,
      pharmacy_id,
      status,
      trial_ends_at,
      current_period_end,
      pharmacies ( name ),
      plans ( name, key )
    `
    )
    .order('updated_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (error) {
    console.error('[sa-subscriptions]', error.code, error.message);
    const fallback = await supabase
      .from('subscriptions')
      .select('id, pharmacy_id, status, pharmacies ( name ), plans ( name )')
      .limit(Math.min(Math.max(limit, 1), 200));
    if (fallback.error) {
      return { ok: false, error: 'No se han podido cargar las suscripciones.' };
    }
    return {
      ok: true,
      rows: ((fallback.data as Record<string, unknown>[] | null) ?? []).map(
        mapRow
      ),
    };
  }

  return {
    ok: true,
    rows: ((data as Record<string, unknown>[] | null) ?? []).map(mapRow),
  };
}

function mapRow(row: Record<string, unknown>): SaSubscriptionRow {
  const ph = row.pharmacies as { name?: string } | null;
  const plan = row.plans as { name?: string; code?: string; key?: string } | null;
  const raw =
    plan?.key ?? plan?.code ?? plan?.name ?? null;
  return {
    id: String(row.id),
    pharmacyId: String(row.pharmacy_id),
    pharmacyName: ph?.name ?? null,
    status: String(row.status ?? ''),
    planName: plan?.name ?? null,
    planLabel: commercialPlanLabel(raw),
    trialEndsAt: row.trial_ends_at == null ? null : String(row.trial_ends_at),
    currentPeriodEnd:
      row.current_period_end == null ? null : String(row.current_period_end),
  };
}
