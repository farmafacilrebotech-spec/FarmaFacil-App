import { createClient } from '@/lib/supabase/server';

export type CustomerProfile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  phone: string | null;
  privacyAcceptedAt: string | null;
  marketingConsentAt: string | null;
};

export type CustomerAddress = {
  id: string;
  label: string | null;
  recipientName: string | null;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  province: string | null;
  countryCode: string;
  isDefault: boolean;
};

export type CustomerOrderSummary = {
  id: string;
  pharmacyId: string;
  displayNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  customerName: string | null;
};

export async function getCustomerProfile(): Promise<
  | { ok: true; profile: CustomerProfile }
  | { ok: false; error: string; code?: 'unauthenticated' | 'not_customer' }
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Debes iniciar sesión.', code: 'unauthenticated' };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, first_name, last_name, phone, account_kind, privacy_accepted_at, marketing_consent_at'
    )
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[customer] profile', error.code, error.message);
    return {
      ok: false,
      error:
        'No se ha podido cargar el perfil. Si acaba de aplicarse la migración 064, reinicia la sesión.',
    };
  }
  if (!data) {
    return { ok: false, error: 'Perfil no encontrado.', code: 'not_customer' };
  }
  if ((data as { account_kind?: string }).account_kind !== 'customer') {
    return {
      ok: false,
      error: 'Esta cuenta no es una cuenta de cliente FarmaFácil.',
      code: 'not_customer',
    };
  }

  const row = data as Record<string, unknown>;
  return {
    ok: true,
    profile: {
      id: String(row.id),
      email: String(row.email ?? user.email ?? ''),
      firstName: (row.first_name as string | null) ?? null,
      lastName: (row.last_name as string | null) ?? null,
      fullName: (row.full_name as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      privacyAcceptedAt: (row.privacy_accepted_at as string | null) ?? null,
      marketingConsentAt: (row.marketing_consent_at as string | null) ?? null,
    },
  };
}

export async function listCustomerAddresses(): Promise<
  | { ok: true; addresses: CustomerAddress[] }
  | { ok: false; error: string }
> {
  const profile = await getCustomerProfile();
  if (!profile.ok) return { ok: false, error: profile.error };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('customer_addresses')
    .select(
      'id, label, recipient_name, line1, line2, postal_code, city, province, country_code, is_default'
    )
    .eq('profile_id', profile.profile.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[customer] addresses', error.code, error.message);
    return { ok: false, error: 'No se han podido cargar las direcciones.' };
  }

  return {
    ok: true,
    addresses: (data ?? []).map((r) => ({
      id: r.id as string,
      label: (r.label as string | null) ?? null,
      recipientName: (r.recipient_name as string | null) ?? null,
      line1: r.line1 as string,
      line2: (r.line2 as string | null) ?? null,
      postalCode: r.postal_code as string,
      city: r.city as string,
      province: (r.province as string | null) ?? null,
      countryCode: (r.country_code as string) ?? 'ES',
      isDefault: Boolean(r.is_default),
    })),
  };
}

export async function listCustomerOrders(): Promise<
  | { ok: true; orders: CustomerOrderSummary[] }
  | { ok: false; error: string }
> {
  const profile = await getCustomerProfile();
  if (!profile.ok) return { ok: false, error: profile.error };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_orders')
    .select(
      'id, pharmacy_id, display_number, status, total_amount, currency, created_at, customer_name'
    )
    .eq('customer_profile_id', profile.profile.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[customer] orders', error.code, error.message);
    return {
      ok: false,
      error:
        'No se han podido cargar los pedidos. Comprueba que la migración 064 está aplicada.',
    };
  }

  return {
    ok: true,
    orders: (data ?? []).map((r) => ({
      id: r.id as string,
      pharmacyId: r.pharmacy_id as string,
      displayNumber: r.display_number as string,
      status: r.status as string,
      totalAmount: Number(r.total_amount ?? 0),
      currency: (r.currency as string) ?? 'EUR',
      createdAt: r.created_at as string,
      customerName: (r.customer_name as string | null) ?? null,
    })),
  };
}
