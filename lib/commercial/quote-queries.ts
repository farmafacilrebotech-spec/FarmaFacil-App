import { createClient } from '@/lib/supabase/server';
import { hasPlatformPermission } from '@/lib/auth/platform';
import { parseQuoteInternalMeta } from './quote-meta';
import type {
  CommercialQuoteListItem,
  CommercialQuoteSnapshot,
  CommercialQuoteStatus,
  QuotePharmacyOption,
} from './quote-types';

export async function canManageCommercialQuotes(): Promise<boolean> {
  const r = await hasPlatformPermission('platform.commercial_quotes.manage');
  return r.ok;
}

function mapSnapshot(raw: unknown): CommercialQuoteSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as CommercialQuoteSnapshot;
  if (s.v !== 1) return null;
  return s;
}

export async function listCommercialQuotes(): Promise<
  | { ok: true; quotes: CommercialQuoteListItem[] }
  | { ok: false; error: string }
> {
  if (!(await canManageCommercialQuotes())) {
    return {
      ok: false,
      error: 'Sin permiso para gestionar presupuestos comerciales.',
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('commercial_quotes')
    .select(
      `
      id,
      reference_code,
      status,
      prospect_name,
      pharmacy_id,
      commercial_sku_key,
      billing_interval,
      kiosk_count,
      one_time_net_cents,
      recurring_net_cents,
      first_year_net_cents,
      first_year_gross_cents,
      valid_until,
      notes,
      internal_notes,
      snapshot,
      created_at,
      updated_at,
      pharmacy:pharmacies ( id, name )
    `
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[commercial-quotes] list', error.code, error.message);
    return { ok: false, error: 'No se han podido cargar los presupuestos.' };
  }

  const quotes: CommercialQuoteListItem[] = (data ?? []).map((row) => {
    const snapshot = mapSnapshot(row.snapshot);
    const meta = parseQuoteInternalMeta(
      (row.internal_notes as string | null) ?? null
    );
    const pharmacyJoin = row.pharmacy as
      | { id: string; name: string }
      | { id: string; name: string }[]
      | null;
    const pharmacy = Array.isArray(pharmacyJoin)
      ? pharmacyJoin[0]
      : pharmacyJoin;

    return {
      id: row.id as string,
      referenceCode: (row.reference_code as string | null) ?? null,
      status: row.status as CommercialQuoteStatus,
      prospectName: (row.prospect_name as string | null) ?? null,
      pharmacyId: (row.pharmacy_id as string | null) ?? null,
      pharmacyName:
        pharmacy?.name ??
        snapshot?.pharmacyName ??
        (row.prospect_name as string | null) ??
        null,
      commercialSkuKey: row.commercial_sku_key as string,
      billingInterval: row.billing_interval as 'monthly' | 'annual',
      kioskCount: Number(row.kiosk_count ?? 0),
      oneTimeNetCents: Number(row.one_time_net_cents ?? 0),
      recurringNetCents: Number(row.recurring_net_cents ?? 0),
      firstYearNetCents: Number(row.first_year_net_cents ?? 0),
      firstYearGrossCents: Number(row.first_year_gross_cents ?? 0),
      validUntil: (row.valid_until as string | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      contactName: snapshot?.contactName ?? null,
      contactEmail: snapshot?.contactEmail ?? null,
      snapshot,
      history: meta.history,
      emailSends: meta.emailSends,
      notes: (row.notes as string | null) ?? null,
    };
  });

  return { ok: true, quotes };
}

export async function listQuotePharmacyOptions(): Promise<QuotePharmacyOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacies')
    .select('id, name, email')
    .order('name', { ascending: true })
    .limit(300);

  if (error) {
    console.error('[commercial-quotes] pharmacies', error.code, error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    email: (r.email as string | null) ?? null,
  }));
}

export async function resolveCurrentTariffVersionId(): Promise<string | null> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc(
    'ff_list_commercial_tariff_versions_commercial_v1'
  );
  if (error) {
    console.error('[commercial-quotes] tariff version', error.code, error.message);
    return null;
  }
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const current =
    rows.find((r) => (r as { is_current?: boolean }).is_current) ?? rows[0];
  if (!current || typeof current !== 'object') return null;
  const id = (current as { id?: string }).id;
  return typeof id === 'string' ? id : null;
}
