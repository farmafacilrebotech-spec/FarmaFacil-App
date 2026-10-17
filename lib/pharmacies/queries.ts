import { createClient } from '@/lib/supabase/server';
import type {
  PharmacyDetail,
  PharmacyListItem,
  PlanSummary,
  PharmacyBranding,
  PharmacySettings,
  PharmacySubscription,
  PharmacyStatus,
  PharmacyMember,
  PharmacyRoleOption,
  PharmacyRoleKey,
  MembershipStatus,
} from './types';

const PHARMACY_ROLE_KEYS: PharmacyRoleKey[] = [
  'PHARMACY_OWNER',
  'PHARMACY_ADMIN',
  'PHARMACIST',
  'STAFF',
];

type PlanRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

function mapPlan(row: PlanRow | PlanRow[] | null): PlanSummary | null {
  if (!row) return null;
  const p = Array.isArray(row) ? row[0] : row;
  if (!p) return null;
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    is_active: p.is_active,
    sort_order: p.sort_order,
  };
}

export async function listActivePlans(): Promise<PlanSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('plans')
    .select('id, key, name, description, is_active, sort_order')
    .eq('is_active', true)
    .in('key', ['starter', 'pro', 'business', 'enterprise'])
    .order('sort_order', { ascending: true });

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pharmacies] listActivePlans', error.message, error.code);
    }
    throw new Error('No se han podido cargar los planes.');
  }

  return (data ?? []) as PlanSummary[];
}

export async function listPharmacies(): Promise<PharmacyListItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacies')
    .select(
      `
      id,
      name,
      legal_name,
      cif,
      email,
      phone,
      city,
      province,
      status,
      logo_color,
      created_at,
      plan:plans ( id, key, name, description, is_active, sort_order )
    `
    )
    .order('created_at', { ascending: false });

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pharmacies] listPharmacies', error.message, error.code);
    }
    throw new Error('No se han podido cargar las farmacias.');
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    legal_name: (row.legal_name as string | null) ?? null,
    cif: (row.cif as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    province: (row.province as string | null) ?? null,
    status: row.status as PharmacyStatus,
    logo_color: (row.logo_color as string | null) ?? null,
    created_at: row.created_at as string,
    plan: mapPlan(row.plan as PlanRow | PlanRow[] | null),
  }));
}

type SubscriptionQueryRow = {
  id: string;
  status: string;
  provider: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_start?: string | null;
  trial_end?: string | null;
  cancel_at_period_end?: boolean | null;
  cancelled_at?: string | null;
  grace_period_ends_at?: string | null;
  commercial_reason?: string | null;
  plan: PlanRow | PlanRow[] | null;
};

function mapSubscriptionRow(sub: SubscriptionQueryRow): PharmacySubscription {
  return {
    id: sub.id,
    status: sub.status as PharmacySubscription['status'],
    provider: sub.provider,
    current_period_start: sub.current_period_start ?? null,
    current_period_end: sub.current_period_end ?? null,
    trial_start: sub.trial_start ?? null,
    trial_end: sub.trial_end ?? null,
    cancel_at_period_end: sub.cancel_at_period_end ?? false,
    cancelled_at: sub.cancelled_at ?? null,
    grace_period_ends_at: sub.grace_period_ends_at ?? null,
    commercial_reason: sub.commercial_reason ?? null,
    plan: mapPlan(sub.plan),
  };
}

/** Suscripción corriente (o última finalizada) de una farmacia. RLS: member+pharmacy.view o plataforma. */
export async function getPharmacySubscription(
  pharmacyId: string
): Promise<PharmacySubscription | null> {
  return loadPharmacySubscriptionRow(pharmacyId);
}

async function loadPharmacySubscriptionRow(
  pharmacyId: string
): Promise<PharmacySubscription | null> {
  const supabase = createClient();

  const fullSelect = `
      id,
      status,
      provider,
      current_period_start,
      current_period_end,
      trial_start,
      trial_end,
      cancel_at_period_end,
      cancelled_at,
      grace_period_ends_at,
      commercial_reason,
      plan:plans ( id, key, name, description, is_active, sort_order )
    `;

  const legacySelect = `
      id,
      status,
      provider,
      current_period_start,
      current_period_end,
      trial_start,
      trial_end,
      cancel_at_period_end,
      cancelled_at,
      plan:plans ( id, key, name, description, is_active, sort_order )
    `;

  async function fetchWith(select: string, currentOnly: boolean) {
    let q = supabase
      .from('subscriptions')
      .select(select)
      .eq('pharmacy_id', pharmacyId);
    if (currentOnly) {
      q = q.in('status', ['trialing', 'active', 'past_due', 'paused']);
    }
    return q.order('updated_at', { ascending: false }).limit(1);
  }

  let { data: rows, error } = await fetchWith(fullSelect, true);

  if (
    error &&
    (error.code === '42703' ||
      error.message?.includes('grace_period_ends_at') ||
      error.message?.includes('commercial_reason'))
  ) {
    ({ data: rows, error } = await fetchWith(legacySelect, true));
  }

  if (error && process.env.NODE_ENV === 'development') {
    console.error('[pharmacies] getPharmacySubscription', error.message);
  }

  let sub = rows?.[0] as SubscriptionQueryRow | undefined;

  // Sin corriente: última cancelled/expired (para reactivar en SuperAdmin)
  if (!sub && !error) {
    let ended = await fetchWith(fullSelect, false);
    if (
      ended.error &&
      (ended.error.code === '42703' ||
        ended.error.message?.includes('grace_period_ends_at'))
    ) {
      ended = await fetchWith(legacySelect, false);
    }
    const row = ended.data?.[0] as SubscriptionQueryRow | undefined;
    if (
      row &&
      (row.status === 'cancelled' ||
        row.status === 'expired' ||
        row.status === 'paused')
    ) {
      sub = row;
    } else if (row) {
      sub = row;
    }
  }

  return sub ? mapSubscriptionRow(sub) : null;
}

export async function getPharmacyById(
  id: string
): Promise<PharmacyDetail | null> {
  const supabase = createClient();

  const pharmacySelectFull = `
      id,
      name,
      legal_name,
      cif,
      email,
      phone,
      web,
      address_line,
      postal_code,
      city,
      province,
      country,
      status,
      logo_color,
      created_at,
      updated_at,
      suspended_at,
      suspension_reason,
      plan:plans ( id, key, name, description, is_active, sort_order ),
      branding:pharmacy_branding (
        pharmacy_id,
        logo_url,
        primary_color,
        secondary_color,
        accent_color,
        font_family,
        border_radius,
        kiosk_wallpaper_url,
        welcome_message
      ),
      settings:pharmacy_settings (
        pharmacy_id,
        visible_name,
        schedule,
        phone,
        whatsapp,
        email,
        timezone
      )
    `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null;
  let error: { message: string; code?: string } | null = null;

  {
    const full = await supabase
      .from('pharmacies')
      .select(pharmacySelectFull)
      .eq('id', id)
      .maybeSingle();
    data = full.data;
    error = full.error;
  }

  // Compatibilidad pre-027: sin suspension_reason
  if (
    error &&
    (error.code === '42703' || error.message?.includes('suspension_reason'))
  ) {
    const legacy = await supabase
      .from('pharmacies')
      .select(
        `
      id, name, legal_name, cif, email, phone, web, address_line, postal_code,
      city, province, country, status, logo_color, created_at, updated_at, suspended_at,
      plan:plans ( id, key, name, description, is_active, sort_order ),
      branding:pharmacy_branding (
        pharmacy_id, logo_url, primary_color, secondary_color, accent_color,
        font_family, border_radius, kiosk_wallpaper_url, welcome_message
      ),
      settings:pharmacy_settings (
        pharmacy_id, visible_name, schedule, phone, whatsapp, email, timezone
      )
    `
      )
      .eq('id', id)
      .maybeSingle();
    data = legacy.data;
    error = legacy.error;
  }

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pharmacies] getPharmacyById', error.message, error.code);
    }
    throw new Error('No se ha podido cargar la farmacia.');
  }

  if (!data) return null;

  const subscription = await loadPharmacySubscriptionRow(id);

  const brandingRaw = data.branding as PharmacyBranding | PharmacyBranding[] | null;
  const settingsRaw = data.settings as PharmacySettings | PharmacySettings[] | null;
  const branding = Array.isArray(brandingRaw) ? brandingRaw[0] ?? null : brandingRaw;
  const settings = Array.isArray(settingsRaw) ? settingsRaw[0] ?? null : settingsRaw;

  return {
    id: data.id as string,
    name: data.name as string,
    legal_name: (data.legal_name as string | null) ?? null,
    cif: (data.cif as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    phone: (data.phone as string | null) ?? null,
    web: (data.web as string | null) ?? null,
    address_line: (data.address_line as string | null) ?? null,
    postal_code: (data.postal_code as string | null) ?? null,
    city: (data.city as string | null) ?? null,
    province: (data.province as string | null) ?? null,
    country: (data.country as string) ?? 'ES',
    status: data.status as PharmacyStatus,
    logo_color: (data.logo_color as string | null) ?? null,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
    suspended_at:
      ((data as { suspended_at?: string | null }).suspended_at as
        | string
        | null
        | undefined) ?? null,
    suspension_reason:
      ((data as { suspension_reason?: string | null }).suspension_reason as
        | string
        | null
        | undefined) ?? null,
    plan: mapPlan(data.plan as PlanRow | PlanRow[] | null),
    branding: branding ?? null,
    settings: settings ?? null,
    subscription,
  };
}

type MemberRow = {
  id: string;
  status: string;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
  profiles:
    | { id: string; email: string; full_name: string | null }
    | { id: string; email: string; full_name: string | null }[]
    | null;
  roles:
    | { key: string; name: string }
    | { key: string; name: string }[]
    | null;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Miembros de una farmacia (misma query para SuperAdmin y panel tenant).
 *
 * Incluye revoked (historial). El embed de profiles exige migración 039:
 * peers revoked visibles solo con memberships.manage (OWNER/ADMIN).
 * Sin 039, OWNER/ADMIN omiten filas revoked (perfil null → continue).
 * Plataforma (users.read/write) ya ve perfiles revoked sin 039.
 *
 * Etiqueta UI: membershipStatusLabel(status, accepted_at).
 */
export async function listPharmacyMembers(
  pharmacyId: string
): Promise<PharmacyMember[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('pharmacy_memberships')
    .select(
      `
      id,
      status,
      invited_at,
      accepted_at,
      created_at,
      profiles!pharmacy_memberships_profile_id_fkey (
        id,
        email,
        full_name
      ),
      roles!pharmacy_memberships_role_id_fkey (
        key,
        name
      )
    `
    )
    .eq('pharmacy_id', pharmacyId)
    .order('created_at', { ascending: true });

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pharmacies] listPharmacyMembers', error.message, error.code);
    }
    throw new Error('No se han podido cargar los usuarios de la farmacia.');
  }

  const members: PharmacyMember[] = [];
  for (const row of (data as MemberRow[] | null) ?? []) {
    const profile = unwrapOne(row.profiles);
    const role = unwrapOne(row.roles);
    // Sin perfil visible (RLS pre-039 en revoked) no se muestra la fila.
    if (!profile || !role) continue;
    members.push({
      id: row.id,
      status: row.status as MembershipStatus,
      invited_at: row.invited_at,
      accepted_at: row.accepted_at,
      created_at: row.created_at,
      profile: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
      },
      role: {
        key: role.key as PharmacyRoleKey,
        name: role.name,
      },
    });
  }

  return members;
}

/**
 * Roles de farmacia del seed (solo keys conocidas).
 */
export async function listPharmacyRoles(): Promise<PharmacyRoleOption[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('roles')
    .select('id, key, name')
    .in('key', PHARMACY_ROLE_KEYS)
    .order('key', { ascending: true });

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pharmacies] listPharmacyRoles', error.message, error.code);
    }
    throw new Error('No se han podido cargar los roles de farmacia.');
  }

  const byKey = new Map(
    ((data as { id: string; key: string; name: string }[] | null) ?? []).map(
      (r) => [r.key, r] as const
    )
  );

  // Orden estable: Propietario primero.
  return PHARMACY_ROLE_KEYS.flatMap((key) => {
    const row = byKey.get(key);
    if (!row) return [];
    return [{ id: row.id, key: key, name: row.name }];
  });
}
