/**
 * Clientes PWA/cuenta (account_kind customer|both) — SuperAdmin solo lectura.
 * No es CRM de Excel; aislamiento: vínculos vía customer_saved_pharmacies / pedidos.
 */

import { createClient } from '@/lib/supabase/server';
import { hasPlatformPermission } from '@/lib/auth/platform';

export type SaCustomerRow = {
  id: string;
  email: string;
  fullName: string | null;
  accountKind: string;
  phone: string | null;
  savedPharmacyCount: number;
};

export async function listSaCustomers(limit = 100): Promise<
  | { ok: true; customers: SaCustomerRow[] }
  | { ok: false; error: string }
> {
  const read = await hasPlatformPermission('platform.pharmacies.read');
  if (!read.ok) {
    return { ok: false, error: 'Sin permiso para consultar clientes de plataforma.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, account_kind, phone')
    .in('account_kind', ['customer', 'both'])
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (error) {
    console.error('[sa-customers]', error.code, error.message);
    return {
      ok: false,
      error:
        error.message.toLowerCase().includes('account_kind')
          ? 'Falta migración de cuentas de cliente (064/071).'
          : 'No se han podido cargar los clientes.',
    };
  }

  const rows = (data as Record<string, unknown>[] | null) ?? [];
  const ids = rows.map((r) => String(r.id));
  const counts = new Map<string, number>();

  if (ids.length > 0) {
    const { data: saved } = await supabase
      .from('customer_saved_pharmacies')
      .select('profile_id')
      .in('profile_id', ids);
    for (const s of (saved as { profile_id: string }[] | null) ?? []) {
      counts.set(s.profile_id, (counts.get(s.profile_id) ?? 0) + 1);
    }
  }

  return {
    ok: true,
    customers: rows.map((r) => ({
      id: String(r.id),
      email: String(r.email ?? ''),
      fullName: r.full_name == null ? null : String(r.full_name),
      accountKind: String(r.account_kind ?? ''),
      phone: r.phone == null ? null : String(r.phone),
      savedPharmacyCount: counts.get(String(r.id)) ?? 0,
    })),
  };
}

export async function listSaCustomersForPharmacy(
  pharmacyId: string,
  limit = 100
): Promise<
  | { ok: true; customers: SaCustomerRow[] }
  | { ok: false; error: string }
> {
  const read = await hasPlatformPermission('platform.pharmacies.read');
  if (!read.ok) {
    return { ok: false, error: 'Sin permiso.' };
  }
  if (!pharmacyId) return { ok: false, error: 'Farmacia no indicada.' };

  const supabase = createClient();
  const { data: saved, error } = await supabase
    .from('customer_saved_pharmacies')
    .select('profile_id')
    .eq('pharmacy_id', pharmacyId)
    .limit(Math.min(Math.max(limit, 1), 200));

  if (error) {
    return { ok: false, error: 'No se han podido cargar clientes de la farmacia.' };
  }

  const ids = Array.from(
    new Set(
      ((saved as { profile_id: string }[] | null) ?? []).map((s) => s.profile_id)
    )
  );
  if (ids.length === 0) return { ok: true, customers: [] };

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, account_kind, phone')
    .in('id', ids);

  if (pErr) {
    return { ok: false, error: 'No se han podido cargar perfiles de cliente.' };
  }

  return {
    ok: true,
    customers: ((profiles as Record<string, unknown>[] | null) ?? []).map((r) => ({
      id: String(r.id),
      email: String(r.email ?? ''),
      fullName: r.full_name == null ? null : String(r.full_name),
      accountKind: String(r.account_kind ?? ''),
      phone: r.phone == null ? null : String(r.phone),
      savedPharmacyCount: 1,
    })),
  };
}
