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

export async function getPharmacyById(
  id: string
): Promise<PharmacyDetail | null> {
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
    `
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[pharmacies] getPharmacyById', error.message, error.code);
    }
    throw new Error('No se ha podido cargar la farmacia.');
  }

  if (!data) return null;

  const { data: subRows, error: subError } = await supabase
    .from('subscriptions')
    .select(
      `
      id,
      status,
      provider,
      current_period_start,
      current_period_end,
      plan:plans ( id, key, name, description, is_active, sort_order )
    `
    )
    .eq('pharmacy_id', id)
    .in('status', ['trialing', 'active', 'past_due', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (subError && process.env.NODE_ENV === 'development') {
    console.error('[pharmacies] getPharmacySubscription', subError.message);
  }

  const sub = subRows?.[0];
  const brandingRaw = data.branding as PharmacyBranding | PharmacyBranding[] | null;
  const settingsRaw = data.settings as PharmacySettings | PharmacySettings[] | null;
  const branding = Array.isArray(brandingRaw) ? brandingRaw[0] ?? null : brandingRaw;
  const settings = Array.isArray(settingsRaw) ? settingsRaw[0] ?? null : settingsRaw;

  let subscription: PharmacySubscription | null = null;
  if (sub) {
    subscription = {
      id: sub.id as string,
      status: sub.status as PharmacySubscription['status'],
      provider: sub.provider as string,
      current_period_start: (sub.current_period_start as string | null) ?? null,
      current_period_end: (sub.current_period_end as string | null) ?? null,
      plan: mapPlan(sub.plan as PlanRow | PlanRow[] | null),
    };
  }

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
 * Miembros de una farmacia (RLS: SuperAdmin con platform.users.read/write).
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
    if (!profile || !role) continue;
    members.push({
      id: row.id,
      status: row.status as MembershipStatus,
      invited_at: row.invited_at,
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
