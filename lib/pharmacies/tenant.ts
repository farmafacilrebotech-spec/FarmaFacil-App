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

export type PharmacyTenantContext = {
  profile: CurrentProfile;
  membership: PharmacyMembershipSummary;
  pharmacy: {
    id: string;
    name: string;
    logoUrl: string | null;
    logoColor: string | null;
  };
  pendingInvitations: PendingPharmacyInvitation[];
};

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

  const { invitations: pendingInvitations } =
    await listPendingPharmacyInvitations(access.profile.id);

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
      pendingInvitations,
    },
  };
}
