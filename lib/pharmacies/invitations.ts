import { createClient } from '@/lib/supabase/server';
import { TERMS_VERSION, PRIVACY_VERSION } from '@/lib/legal/versions';
import {
  mapPendingInvitationRpcRows,
  type PendingPharmacyInvitation,
} from '@/lib/pharmacies/pending-invitations';

export type { PendingPharmacyInvitation };

/**
 * Invitaciones pending (status=invited) del usuario autenticado.
 *
 * Usa RPC SECURITY DEFINER 033 (ff_list_pending_pharmacy_invitations_v1):
 * solo filas del auth.uid(), sin embeds RLS sobre pharmacies/roles que
 * ocultan datos a invited. profileId se conserva por firma de callers;
 * la autorización real es auth.uid() en la RPC (no se confía en el argumento).
 */
export async function listPendingPharmacyInvitations(
  _profileId: string
): Promise<{ invitations: PendingPharmacyInvitation[]; error?: string }> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc(
    'ff_list_pending_pharmacy_invitations_v1'
  );

  if (error) {
    console.error('[invitations] list pending rpc', error.code, error.message);
    return { invitations: [], error: error.message };
  }

  const rows = Array.isArray(data) ? data : [];
  return {
    invitations: mapPendingInvitationRpcRows(
      rows as Parameters<typeof mapPendingInvitationRpcRows>[0]
    ),
  };
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
