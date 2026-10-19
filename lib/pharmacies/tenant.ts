import { createClient } from '@/lib/supabase/server';
import {
  requireActivePharmacyMembership,
  type PharmacyMembershipSummary,
  type CurrentProfile,
} from '@/lib/auth/access';
import {
  listPendingPharmacyInvitations,
  type PendingPharmacyInvitation,
} from '@/lib/pharmacies/invitations';
import type { ShellPharmacyOption } from '@/lib/pharmacies/shell-pharmacies';

export type PharmacyTenantContext = {
  profile: CurrentProfile;
  membership: PharmacyMembershipSummary;
  pharmacy: {
    id: string;
    name: string;
    logoUrl: string | null;
    logoColor: string | null;
  };
  /** Farmacias con membership active del usuario (RLS). Para el selector. */
  authorizedPharmacies: ShellPharmacyOption[];
  pendingInvitations: PendingPharmacyInvitation[];
};

type AuthorizedMembershipRow = {
  pharmacy_id: string;
  roles:
    | { key: string; name: string }
    | { key: string; name: string }[]
    | null;
  pharmacies:
    | {
        id: string;
        name: string;
        city: string | null;
        province: string | null;
        logo_color: string | null;
        pharmacy_branding:
          | { logo_url: string | null }
          | { logo_url: string | null }[]
          | null;
      }
    | {
        id: string;
        name: string;
        city: string | null;
        province: string | null;
        logo_color: string | null;
        pharmacy_branding:
          | { logo_url: string | null }
          | { logo_url: string | null }[]
          | null;
      }[]
    | null;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

/**
 * Lista farmacias con membership active del perfil (cualquier rol).
 * Incluye roleKey/roleName para el selector. Aislamiento RLS por profile_id.
 */
export async function listAuthorizedPharmaciesForProfile(
  profileId: string
): Promise<ShellPharmacyOption[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_memberships')
    .select(
      `
      pharmacy_id,
      roles!pharmacy_memberships_role_id_fkey (
        key,
        name
      ),
      pharmacies!pharmacy_memberships_pharmacy_id_fkey!inner (
        id,
        name,
        city,
        province,
        logo_color,
        pharmacy_branding ( logo_url )
      )
    `
    )
    .eq('profile_id', profileId)
    .eq('status', 'active');

  if (error) {
    console.error(
      '[pharmacy-tenant] listAuthorizedPharmacies',
      error.code,
      error.message
    );
    return [];
  }

  const options: ShellPharmacyOption[] = [];
  for (const row of (data as AuthorizedMembershipRow[] | null) ?? []) {
    const ph = unwrapOne(row.pharmacies);
    if (!ph?.id) continue;
    const role = unwrapOne(row.roles);
    const branding = unwrapOne(ph.pharmacy_branding);
    options.push({
      id: ph.id,
      name: ph.name,
      city: ph.city ?? null,
      province: ph.province ?? null,
      logoColor: ph.logo_color ?? null,
      logoUrl: branding?.logo_url ?? null,
      roleKey: role?.key ?? null,
      roleName: role?.name ?? null,
    });
  }

  options.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return options;
}

/**
 * Persiste preferencia last_pharmacy_id (trigger exige membership active).
 * No autoriza por sí sola; solo mejora el próximo login / continue.
 */
export async function persistLastPharmacyPreference(
  profileId: string,
  pharmacyId: string
): Promise<void> {
  if (!profileId || !pharmacyId) return;
  const supabase = createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ last_pharmacy_id: pharmacyId })
    .eq('id', profileId);

  if (error) {
    console.error(
      '[pharmacy-tenant] persistLastPharmacy',
      error.code,
      error.message
    );
  }
}

/**
 * Carga contexto tenant solo si hay membership active para pharmacyId.
 * RLS + requireActivePharmacyMembership; no confía en el id de URL solo.
 */
export async function loadPharmacyTenantContext(
  pharmacyId: string
): Promise<
  | { ok: true; context: PharmacyTenantContext }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' | 'error'; message?: string }
> {
  const access = await requireActivePharmacyMembership(pharmacyId);
  if (!access.ok) {
    return access;
  }

  const supabase = createClient();

  const { data: pharmacy, error } = await supabase
    .from('pharmacies')
    .select(
      `
      id,
      name,
      logo_color,
      pharmacy_branding (
        logo_url
      )
    `
    )
    .eq('id', pharmacyId)
    .maybeSingle();

  if (error) {
    console.error('[pharmacy-tenant] load pharmacy', error.code, error.message);
    return { ok: false, reason: 'error', message: error.message };
  }

  if (!pharmacy) {
    return { ok: false, reason: 'forbidden' };
  }

  const branding = unwrapOne(
    pharmacy.pharmacy_branding as
      | { logo_url: string | null }
      | { logo_url: string | null }[]
      | null
  );

  const [{ invitations: pendingInvitations }, authorizedPharmacies] =
    await Promise.all([
      listPendingPharmacyInvitations(access.profile.id),
      listAuthorizedPharmaciesForProfile(access.profile.id),
    ]);

  // Preferencia validada: solo tras comprobar membership active en servidor.
  void persistLastPharmacyPreference(access.profile.id, pharmacyId);

  return {
    ok: true,
    context: {
      profile: access.profile,
      membership: access.membership,
      pharmacy: {
        id: pharmacy.id as string,
        name: pharmacy.name as string,
        logoUrl: branding?.logo_url ?? null,
        logoColor: (pharmacy.logo_color as string | null) ?? null,
      },
      authorizedPharmacies,
      pendingInvitations,
    },
  };
}
