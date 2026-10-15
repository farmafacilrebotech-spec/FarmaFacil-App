import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  classifyInviteUserKind,
  type PharmacyInviteUserKind,
} from '@/lib/pharmacies/invite-user-kind-logic';

export type { PharmacyInviteUserKind };
export { classifyInviteUserKind };

export type ResolvePharmacyInviteUserKindResult =
  | { ok: true; kind: PharmacyInviteUserKind }
  | { ok: false; error: string };

/**
 * Clasifica si el destinatario de una invitación es usuario Auth/profile
 * reutilizable (existing) o alta Auth pendiente (new).
 *
 * - Auth: Admin API (getUserById).
 * - profiles / pharmacy_memberships: cliente JWT del SuperAdmin (RLS).
 *   No usar service_role aquí: en este proyecto service_role no tiene
 *   GRANT SELECT sobre esas tablas (solo Auth Admin).
 *
 * No usa: legal, last_sign_in_at, email_confirmed_at.
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
    console.error('[invite-user-kind] getUserById', authError.message);
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

  // Lecturas de app: sesión SuperAdmin + RLS (platform.users.read|write).
  const supabase = createClient();

  const { data: profile, error: profileError } = await supabase
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

  const { data: memberships, error: membershipError } = await supabase
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

  return {
    ok: true,
    kind: classifyInviteUserKind(
      (memberships ?? []).map((row) => String(row.status ?? ''))
    ),
  };
}
