import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasCurrentLegalAcceptance } from '@/lib/pharmacies/invitations';

/**
 * Distingue usuario nuevo (alta Auth pendiente) vs usuario FarmaFácil establecido.
 * Usado en reenvío de invitación y edición de email.
 *
 * Establecido si:
 * - ya firmó legal vigente, o
 * - tiene alguna membership active (otra farmacia), o
 * - Auth: email confirmado y ha iniciado sesión al menos una vez.
 */
export async function resolvePharmacyInviteUserKind(
  profileId: string
): Promise<'new' | 'existing'> {
  const hasLegal = await hasCurrentLegalAcceptance(profileId);
  if (hasLegal) return 'existing';

  const supabase = createClient();
  const { count, error } = await supabase
    .from('pharmacy_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profileId)
    .eq('status', 'active');

  if (!error && (count ?? 0) > 0) {
    return 'existing';
  }

  try {
    const admin = createAdminClient();
    const { data, error: authError } =
      await admin.auth.admin.getUserById(profileId);
    if (authError || !data?.user) {
      // Conservador: tratar como nuevo si no podemos leer Auth.
      return 'new';
    }
    const user = data.user;
    if (user.last_sign_in_at && user.email_confirmed_at) {
      return 'existing';
    }
    // Invitado Auth sin login: flujo de alta pendiente.
    return 'new';
  } catch {
    return 'new';
  }
}
