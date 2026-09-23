import { createClient } from '@/lib/supabase/server';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions';

export type PendingPharmacyInvitation = {
  membershipId: string;
  pharmacyId: string;
  pharmacyName: string;
  roleKey: string;
  roleName: string;
  invitedAt: string | null;
};

/**
 * Invitaciones pending (status=invited) del usuario autenticado.
 * RLS: solo filas propias.
 */
export async function listPendingPharmacyInvitations(
  profileId: string
): Promise<{ invitations: PendingPharmacyInvitation[]; error?: string }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('pharmacy_memberships')
    .select(
      `
      id,
      pharmacy_id,
      invited_at,
      pharmacies!inner ( id, name ),
      roles!inner ( key, name )
    `
    )
    .eq('profile_id', profileId)
    .eq('status', 'invited')
    .order('invited_at', { ascending: false });

  if (error) {
    console.error('[invitations] list pending', error.code, error.message);
    return { invitations: [], error: error.message };
  }

  const invitations: PendingPharmacyInvitation[] = [];
  for (const row of data ?? []) {
    const pharmacyRaw = (row as { pharmacies?: unknown }).pharmacies;
    const roleRaw = (row as { roles?: unknown }).roles;
    const pharmacy = Array.isArray(pharmacyRaw) ? pharmacyRaw[0] : pharmacyRaw;
    const role = Array.isArray(roleRaw) ? roleRaw[0] : roleRaw;
    if (
      !pharmacy ||
      typeof pharmacy !== 'object' ||
      !('name' in pharmacy) ||
      !role ||
      typeof role !== 'object' ||
      !('key' in role)
    ) {
      continue;
    }
    invitations.push({
      membershipId: (row as { id: string }).id,
      pharmacyId: (row as { pharmacy_id: string }).pharmacy_id,
      pharmacyName: String((pharmacy as { name: string }).name),
      roleKey: String((role as { key: string }).key),
      roleName: String((role as { name: string }).name),
      invitedAt: (row as { invited_at: string | null }).invited_at,
    });
  }

  return { invitations };
}

/**
 * True si el perfil ya aceptó las versiones legales vigentes.
 * Usuarios FarmaFácil establecidos no deben pasar por first-access otra vez.
 */
export async function hasCurrentLegalAcceptance(
  profileId: string
): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('user_legal_acceptances')
    .select('id')
    .eq('profile_id', profileId)
    .eq('terms_version', TERMS_VERSION)
    .eq('privacy_version', PRIVACY_VERSION)
    .maybeSingle();

  if (error) {
    console.error('[invitations] legal check', error.code, error.message);
    return false;
  }

  return data != null;
}
