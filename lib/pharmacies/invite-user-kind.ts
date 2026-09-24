import { createAdminClient } from '@/lib/supabase/admin';

export type PharmacyInviteUserKind = 'new' | 'existing';

export type ResolvePharmacyInviteUserKindResult =
  | { ok: true; kind: PharmacyInviteUserKind }
  | { ok: false; error: string };

/**
 * Clasifica si el destinatario de una invitación es usuario Auth/profile
 * reutilizable (existing) o alta Auth pendiente (new).
 *
 * Criterio (solo Admin / service_role, sin RLS):
 * - Debe existir auth.users y profiles; si la consulta falla → error explícito
 *   (nunca degradar en silencio a «new»).
 * - existing: tiene alguna membership en estado distinto de «invited»
 *   (ya fue usuario real de FarmaFácil: active / suspended / revoked).
 * - new: solo memberships «invited» (alta Auth pendiente de first-access).
 *
 * No usa: legal, last_sign_in_at, email_confirmed_at, ni cliente RLS.
 */
export async function resolvePharmacyInviteUserKind(
  profileId: string
): Promise<ResolvePharmacyInviteUserKindResult> {
  const id = profileId?.trim() ?? '';
  if (!id) {
    return { ok: false, error: 'Identificador de usuario no válido.' };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      error:
        'No se ha podido verificar el usuario (configuración Admin incompleta).',
    };
  }

  const { data: authData, error: authError } =
    await admin.auth.admin.getUserById(id);

  if (authError) {
    console.error(
      '[invite-user-kind] getUserById',
      authError.message
    );
    return {
      ok: false,
      error:
        'No se ha podido verificar el usuario en Auth. No se ha enviado ningún email.',
    };
  }

  if (!authData?.user) {
    return {
      ok: false,
      error:
        'El usuario no existe en Auth. No se puede reenviar la invitación.',
    };
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (profileError) {
    console.error(
      '[invite-user-kind] profile',
      profileError.code,
      profileError.message
    );
    return {
      ok: false,
      error:
        'No se ha podido verificar el perfil. No se ha enviado ningún email.',
    };
  }

  if (!profile) {
    return {
      ok: false,
      error:
        'El perfil del usuario no existe. No se puede reenviar la invitación.',
    };
  }

  const { data: memberships, error: membershipError } = await admin
    .from('pharmacy_memberships')
    .select('id, status')
    .eq('profile_id', id);

  if (membershipError) {
    console.error(
      '[invite-user-kind] memberships',
      membershipError.code,
      membershipError.message
    );
    return {
      ok: false,
      error:
        'No se han podido verificar las membresías del usuario. No se ha enviado ningún email.',
    };
  }

  const rows = memberships ?? [];
  // Ya fue miembro real (otra farmacia o estado no pendiente) → cuenta reutilizable.
  const hasReusableMembership = rows.some(
    (row) => row.status !== 'invited'
  );

  if (hasReusableMembership) {
    return { ok: true, kind: 'existing' };
  }

  // Solo memberships invited: alta Auth pendiente (first-access).
  return { ok: true, kind: 'new' };
}
