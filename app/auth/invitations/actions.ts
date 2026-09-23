'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth/platform';
import { resolveAppAccess, destinationForAppAccess } from '@/lib/auth/access';

export type AcceptPharmacyInvitationResult =
  | { ok: true; pharmacyId: string; redirectTo: string }
  | { ok: false; error: string };

/**
 * Acepta una membership invited concreta del usuario autenticado.
 * Autorización real en RPC: profile_id = auth.uid() + status invited.
 * No pasa por first-access ni re-acepta legal.
 */
export async function acceptPharmacyInvitationAction(
  membershipId: string
): Promise<AcceptPharmacyInvitationResult> {
  const id = membershipId?.trim() ?? '';
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: 'Invitación no válida.' };
  }

  const { profile, authenticated } = await getCurrentProfile();
  if (!authenticated || !profile) {
    return { ok: false, error: 'Debes iniciar sesión para aceptar la invitación.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_accept_pharmacy_membership_v1',
    { p_membership_id: id }
  );

  if (error) {
    console.error('[invitations] accept rpc', error.code, error.message);
    if (
      error.code === '42883' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        error:
          'La aceptación de invitaciones aún no está disponible en la base de datos. Contacta con FarmaFácil.',
      };
    }
    return {
      ok: false,
      error: 'No se ha podido aceptar la invitación. Inténtalo de nuevo.',
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status =
    payload && 'status' in payload ? String(payload.status) : undefined;

  if (status === 'ok') {
    const pharmacyId =
      payload && typeof payload.pharmacy_id === 'string'
        ? payload.pharmacy_id
        : null;

    revalidatePath('/auth/invitations');
    revalidatePath('/auth/select-pharmacy');

    if (pharmacyId && /^[0-9a-f-]{36}$/i.test(pharmacyId)) {
      // Si hay varias active, el selector decidirá en el próximo resolve.
      const access = await resolveAppAccess();
      if (access.status === 'multiple_pharmacies') {
        return {
          ok: true,
          pharmacyId,
          redirectTo: '/auth/select-pharmacy',
        };
      }
      return {
        ok: true,
        pharmacyId,
        redirectTo: `/f/${pharmacyId}/dashboard`,
      };
    }

    const access = await resolveAppAccess();
    return {
      ok: true,
      pharmacyId: pharmacyId ?? '',
      redirectTo: destinationForAppAccess(access),
    };
  }

  if (status === 'not_found') {
    return {
      ok: false,
      error: 'No se ha encontrado esa invitación o no te pertenece.',
    };
  }

  if (status === 'invalid_state') {
    return {
      ok: false,
      error: 'Esa invitación ya no está pendiente.',
    };
  }
  if (status === 'unauthenticated') {
    return { ok: false, error: 'Debes iniciar sesión.' };
  }

  return {
    ok: false,
    error: 'No se ha podido aceptar la invitación.',
  };
}
