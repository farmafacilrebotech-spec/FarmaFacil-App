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

/**
 * Lista farmacias con membership active del perfil (aislamiento RLS).
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
      pharmacies!inner (
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
  for (const row of data ?? []) {
    const raw = row.pharmacies as
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
    const ph = Array.isArray(raw) ? raw[0] : raw;
    if (!ph?.id) continue;
    const brandingRaw = ph.pharmacy_branding;
    const branding = Array.isArray(brandingRaw)
      ? brandingRaw[0] ?? null
      : brandingRaw;
    options.push({
      id: ph.id,
      name: ph.name,
      city: ph.city ?? null,
      province: ph.province ?? null,
      logoColor: ph.logo_color ?? null,
      logoUrl: branding?.logo_url ?? null,
    });
  }

  options.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return options;
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

  const brandingRaw = pharmacy.pharmacy_branding as
    | { logo_url: string | null }
    | { logo_url: string | null }[]
    | null;
  const branding = Array.isArray(brandingRaw)
    ? brandingRaw[0] ?? null
    : brandingRaw;

  const [{ invitations: pendingInvitations }, authorizedPharmacies] =
    await Promise.all([
      listPendingPharmacyInvitations(access.profile.id),
      listAuthorizedPharmaciesForProfile(access.profile.id),
    ]);

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
