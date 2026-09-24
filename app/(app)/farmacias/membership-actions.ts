'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getCurrentProfile,
  hasPlatformSuperAdminRole,
  hasPlatformPermission,
} from '@/lib/auth/platform';
import type { MembershipStatus, PharmacyRoleKey } from '@/lib/pharmacies/types';
import { sendExistingUserPharmacyInviteEmail } from '@/lib/email/pharmacy-invitation';
import { resolvePharmacyInviteUserKind } from '@/lib/pharmacies/invite-user-kind';
import { requestPasswordRecoveryEmail } from '@/lib/auth/password-recovery';

export type MembershipLifecycleResult =
  | { ok: true; message: string }
  | { ok: false; error: string; code?: 'last_active_owner' | 'invalid_state' };

type MembershipRow = {
  id: string;
  pharmacy_id: string;
  profile_id: string;
  status: MembershipStatus;
  roles: { key: PharmacyRoleKey; name: string } | { key: PharmacyRoleKey; name: string }[] | null;
  profiles:
    | { id: string; email: string; full_name: string | null }
    | { id: string; email: string; full_name: string | null }[]
    | null;
};

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/** URL de app desde entorno (nunca desde el navegador). */
function getAppBaseUrl(): string | null {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim();

  if (process.env.NODE_ENV === 'production') {
    if (!configured) return null;
    if (/localhost|127\.0\.0\.1/i.test(configured)) return null;
    return configured.replace(/\/$/, '');
  }

  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:3000';
}

async function requireSuperAdminUsersWrite(): Promise<
  | { ok: true; actorId: string }
  | { ok: false; error: string }
> {
  const {
    profile,
    authenticated,
    error: profileError,
  } = await getCurrentProfile();

  if (!authenticated || !profile) {
    return { ok: false, error: 'Debes iniciar sesión.' };
  }
  if (profileError) {
    return { ok: false, error: 'No se ha podido verificar tu sesión.' };
  }

  const superAdmin = await hasPlatformSuperAdminRole(profile.id);
  if (superAdmin.error) {
    return {
      ok: false,
      error: 'No se ha podido verificar tu rol de plataforma.',
    };
  }
  if (!superAdmin.ok) {
    return {
      ok: false,
      error: 'Solo un SuperAdministrador puede gestionar usuarios de farmacia.',
    };
  }

  const canWrite = await hasPlatformPermission('platform.users.write');
  if (canWrite.error) {
    return {
      ok: false,
      error: 'No se ha podido verificar tu permiso de usuarios.',
    };
  }
  if (!canWrite.ok) {
    return {
      ok: false,
      error: 'No tienes permiso para gestionar usuarios de farmacia.',
    };
  }

  return { ok: true, actorId: profile.id };
}

async function loadMembershipForPharmacy(
  pharmacyId: string,
  membershipId: string
): Promise<
  | {
      ok: true;
      membership: {
        id: string;
        pharmacyId: string;
        profileId: string;
        status: MembershipStatus;
        roleKey: PharmacyRoleKey;
        email: string;
        fullName: string | null;
      };
    }
  | { ok: false; error: string }
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('pharmacy_memberships')
    .select(
      `
      id,
      pharmacy_id,
      profile_id,
      status,
      roles!pharmacy_memberships_role_id_fkey ( key, name ),
      profiles!pharmacy_memberships_profile_id_fkey ( id, email, full_name )
    `
    )
    .eq('id', membershipId)
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();

  if (error) {
    console.error('[membership] load', error.code, error.message);
    return {
      ok: false,
      error: 'No se ha podido cargar la membresía.',
    };
  }

  if (!data) {
    return {
      ok: false,
      error: 'La membresía no pertenece a esta farmacia o no existe.',
    };
  }

  const row = data as MembershipRow;
  const role = unwrapOne(row.roles);
  const profile = unwrapOne(row.profiles);
  if (!role || !profile) {
    return {
      ok: false,
      error: 'La membresía no tiene rol o perfil válidos.',
    };
  }

  return {
    ok: true,
    membership: {
      id: row.id,
      pharmacyId: row.pharmacy_id,
      profileId: row.profile_id,
      status: row.status,
      roleKey: role.key,
      email: profile.email,
      fullName: profile.full_name,
    },
  };
}

/**
 * Bloquea democión de rol del último PHARMACY_OWNER activo (edición de usuario).
 * Las transiciones suspend/revoke usan la misma protección en la RPC 023.
 */
async function wouldRemoveLastActiveOwner(
  pharmacyId: string,
  membership: { id: string; status: MembershipStatus; roleKey: PharmacyRoleKey }
): Promise<{ blocked: boolean; error?: string }> {
  if (
    membership.status !== 'active' ||
    membership.roleKey !== 'PHARMACY_OWNER'
  ) {
    return { blocked: false };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_memberships')
    .select(
      `
      id,
      roles!pharmacy_memberships_role_id_fkey!inner ( key )
    `
    )
    .eq('pharmacy_id', pharmacyId)
    .eq('status', 'active')
    .eq('roles.key', 'PHARMACY_OWNER');

  if (error) {
    console.error('[membership] last owner check', error.code, error.message);
    return {
      blocked: true,
      error: 'No se ha podido verificar los propietarios activos de la farmacia.',
    };
  }

  const owners = data ?? [];
  if (owners.length <= 1) {
    return {
      blocked: true,
      error:
        'No se puede suspender ni revocar al último propietario activo. Asigna antes otro propietario (PHARMACY_OWNER) a esta farmacia.',
    };
  }

  return { blocked: false };
}

type TransitionAction =
  | 'suspend'
  | 'reactivate'
  | 'revoke'
  | 'cancel_invitation'
  | 'reinvite';

/**
 * Transición vía ff_transition_pharmacy_membership_v1 (migración 023).
 * Autorización + último owner + estado en la RPC (SECURITY DEFINER).
 */
async function transitionMembershipViaRpc(params: {
  pharmacyId: string;
  membershipId: string;
  action: TransitionAction;
  successMessage: string;
}): Promise<MembershipLifecycleResult> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_transition_pharmacy_membership_v1',
    {
      p_pharmacy_id: params.pharmacyId,
      p_membership_id: params.membershipId,
      p_action: params.action,
    }
  );

  if (error) {
    console.error(
      '[membership] transition rpc',
      params.action,
      error.code,
      error.message
    );

    if (
      error.code === '42883' ||
      error.code === 'PGRST202' ||
      error.message.toLowerCase().includes('does not exist') ||
      error.message.toLowerCase().includes('could not find the function')
    ) {
      return {
        ok: false,
        error:
          'Las transiciones de membresía aún no están disponibles en la API. Recarga el schema PostgREST o contacta con FarmaFácil.',
      };
    }

    const msg = error.message || '';
    const msgLower = msg.toLowerCase();
    if (
      error.code === '42501' ||
      msgLower.includes('forbidden') ||
      msgLower.includes('permission denied') ||
      msgLower.includes('no tienes permiso')
    ) {
      return {
        ok: false,
        error: 'No tienes permiso para gestionar usuarios de farmacia.',
      };
    }
    if (
      msgLower.includes('last_active_owner') ||
      msgLower.includes('último propietario') ||
      msgLower.includes('ultimo propietario')
    ) {
      return {
        ok: false,
        error:
          'No se puede suspender ni revocar al último propietario activo. Asigna antes otro propietario (PHARMACY_OWNER) a esta farmacia.',
        code: 'last_active_owner',
      };
    }
    if (
      msgLower.includes('invalid_state') ||
      msgLower.includes('solo se puede cancelar') ||
      msgLower.includes('solo se puede suspender') ||
      msgLower.includes('solo se puede reactivar') ||
      msgLower.includes('solo se puede volver a invitar') ||
      msgLower.includes('ha cambiado')
    ) {
      return {
        ok: false,
        error:
          msg.replace(/^.*invalid_state:?\s*/i, '').trim() ||
          'El estado de la membresía ha cambiado. Recarga e inténtalo de nuevo.',
        code: 'invalid_state',
      };
    }
    if (msgLower.includes('not_found') || msgLower.includes('no pertenece')) {
      return {
        ok: false,
        error: 'La membresía no pertenece a esta farmacia o no existe.',
      };
    }
    if (
      msgLower.includes('unauthenticated') ||
      msgLower.includes('iniciar sesión')
    ) {
      return {
        ok: false,
        error: 'Debes iniciar sesión para gestionar usuarios.',
      };
    }

    return {
      ok: false,
      error: msg.trim() || 'No se ha podido actualizar el acceso del usuario.',
    };
  }

  let payload: Record<string, unknown> | null = null;
  try {
    if (typeof data === 'string') {
      payload = JSON.parse(data) as Record<string, unknown>;
    } else if (data && typeof data === 'object') {
      payload = data as Record<string, unknown>;
    }
  } catch {
    payload = null;
  }
  const status =
    payload && 'status' in payload ? String(payload.status) : undefined;

  if (status !== 'ok') {
    return {
      ok: false,
      error: 'No se ha podido actualizar el acceso del usuario.',
      code: 'invalid_state',
    };
  }

  revalidatePath(`/farmacias/${params.pharmacyId}`);
  revalidatePath('/auth/invitations');
  revalidatePath('/auth/select-pharmacy');
  return { ok: true, message: params.successMessage };
}

export async function suspendPharmacyMembershipAction(input: {
  pharmacyId: string;
  membershipId: string;
}): Promise<MembershipLifecycleResult> {
  const pharmacyId = input.pharmacyId?.trim() ?? '';
  const membershipId = input.membershipId?.trim() ?? '';
  if (!pharmacyId || !membershipId) {
    return { ok: false, error: 'Datos de membresía no válidos.' };
  }

  const auth = await requireSuperAdminUsersWrite();
  if (!auth.ok) return auth;

  const loaded = await loadMembershipForPharmacy(pharmacyId, membershipId);
  if (!loaded.ok) return loaded;

  if (loaded.membership.status !== 'active') {
    return {
      ok: false,
      error: 'Solo se puede suspender un usuario con acceso activo.',
      code: 'invalid_state',
    };
  }

  return transitionMembershipViaRpc({
    pharmacyId,
    membershipId,
    action: 'suspend',
    successMessage:
      'Acceso suspendido. El usuario ya no puede entrar a esta farmacia.',
  });
}

export async function reactivatePharmacyMembershipAction(input: {
  pharmacyId: string;
  membershipId: string;
}): Promise<MembershipLifecycleResult> {
  const pharmacyId = input.pharmacyId?.trim() ?? '';
  const membershipId = input.membershipId?.trim() ?? '';
  if (!pharmacyId || !membershipId) {
    return { ok: false, error: 'Datos de membresía no válidos.' };
  }

  const auth = await requireSuperAdminUsersWrite();
  if (!auth.ok) return auth;

  const loaded = await loadMembershipForPharmacy(pharmacyId, membershipId);
  if (!loaded.ok) return loaded;

  if (loaded.membership.status !== 'suspended') {
    return {
      ok: false,
      error: 'Solo se puede reactivar un usuario suspendido.',
      code: 'invalid_state',
    };
  }

  return transitionMembershipViaRpc({
    pharmacyId,
    membershipId,
    action: 'reactivate',
    successMessage:
      'Acceso reactivado. El usuario vuelve a tener acceso a esta farmacia.',
  });
}

export async function revokePharmacyMembershipAction(input: {
  pharmacyId: string;
  membershipId: string;
}): Promise<MembershipLifecycleResult> {
  const pharmacyId = input.pharmacyId?.trim() ?? '';
  const membershipId = input.membershipId?.trim() ?? '';
  if (!pharmacyId || !membershipId) {
    return { ok: false, error: 'Datos de membresía no válidos.' };
  }

  const auth = await requireSuperAdminUsersWrite();
  if (!auth.ok) return auth;

  const loaded = await loadMembershipForPharmacy(pharmacyId, membershipId);
  if (!loaded.ok) return loaded;

  if (
    loaded.membership.status !== 'active' &&
    loaded.membership.status !== 'suspended'
  ) {
    return {
      ok: false,
      error: 'Solo se puede revocar un acceso activo o suspendido.',
      code: 'invalid_state',
    };
  }

  return transitionMembershipViaRpc({
    pharmacyId,
    membershipId,
    action: 'revoke',
    successMessage:
      'Acceso revocado. El usuario ya no pertenece a esta farmacia.',
  });
}

export async function cancelPharmacyInvitationAction(input: {
  pharmacyId: string;
  membershipId: string;
}): Promise<MembershipLifecycleResult> {
  const pharmacyId = input.pharmacyId?.trim() ?? '';
  const membershipId = input.membershipId?.trim() ?? '';
  if (!pharmacyId || !membershipId) {
    return { ok: false, error: 'Datos de membresía no válidos.' };
  }

  const auth = await requireSuperAdminUsersWrite();
  if (!auth.ok) return auth;

  const loaded = await loadMembershipForPharmacy(pharmacyId, membershipId);
  if (!loaded.ok) return loaded;

  if (loaded.membership.status !== 'invited') {
    return {
      ok: false,
      error: 'Solo se puede cancelar una invitación pendiente.',
      code: 'invalid_state',
    };
  }

  return transitionMembershipViaRpc({
    pharmacyId,
    membershipId,
    action: 'cancel_invitation',
    successMessage:
      'Invitación cancelada. Ya no es válida para completar el acceso.',
  });
}

/**
 * Reenvía la invitación pendiente SIN crear otra membership.
 * - Usuario nuevo (alta pendiente): inviteUserByEmail (Auth).
 * - Usuario FarmaFácil existente: email propio «Te han invitado a {farmacia}».
 */
export async function resendPharmacyInvitationAction(input: {
  pharmacyId: string;
  membershipId: string;
}): Promise<MembershipLifecycleResult> {
  const pharmacyId = input.pharmacyId?.trim() ?? '';
  const membershipId = input.membershipId?.trim() ?? '';
  if (!pharmacyId || !membershipId) {
    return { ok: false, error: 'Datos de membresía no válidos.' };
  }

  const auth = await requireSuperAdminUsersWrite();
  if (!auth.ok) return auth;

  const loaded = await loadMembershipForPharmacy(pharmacyId, membershipId);
  if (!loaded.ok) return loaded;

  if (loaded.membership.status !== 'invited') {
    return {
      ok: false,
      error: 'Solo se puede reenviar la invitación de un usuario pendiente.',
      code: 'invalid_state',
    };
  }

  const appBaseUrl = getAppBaseUrl();
  if (!appBaseUrl) {
    return {
      ok: false,
      error:
        'Falta una URL de aplicación válida (NEXT_PUBLIC_APP_URL). En producción no se permite localhost.',
    };
  }

  const supabase = createClient();
  const { data: pharmacy } = await supabase
    .from('pharmacies')
    .select('name')
    .eq('id', pharmacyId)
    .maybeSingle();
  const pharmacyName =
    typeof pharmacy?.name === 'string' && pharmacy.name.trim()
      ? pharmacy.name.trim()
      : 'tu farmacia';

  const email = loaded.membership.email;
  const fullName = loaded.membership.fullName?.trim() || undefined;
  const kindResult = await resolvePharmacyInviteUserKind(
    loaded.membership.profileId
  );

  if (!kindResult.ok) {
    return { ok: false, error: kindResult.error };
  }

  // Usuario FarmaFácil reutilizable (otra farmacia / cuenta ya establecida):
  // siempre plantilla V2 + magic link token_hash → /auth/invitations.
  if (kindResult.kind === 'existing') {
    const sent = await sendExistingUserPharmacyInviteEmail({
      to: email,
      pharmacyName,
      appBaseUrl,
      recipientName: fullName,
    });

    if (!sent.ok) {
      return { ok: false, error: sent.error };
    }

    const now = new Date().toISOString();
    await supabase
      .from('pharmacy_memberships')
      .update({
        invited_at: now,
        updated_by: auth.actorId,
        updated_at: now,
      })
      .eq('id', membershipId)
      .eq('pharmacy_id', pharmacyId)
      .eq('status', 'invited');

    revalidatePath(`/farmacias/${pharmacyId}`);
    return {
      ok: true,
      message: `Invitación reenviada: se ha notificado el acceso a ${pharmacyName}.`,
    };
  }

  // Usuario nuevo: solo alta Auth pendiente → inviteUserByEmail (Supabase Auth).
  // Si Auth indica que el usuario ya existe, no usar HTML inline: es existing → V2.
  const redirectTo = `${appBaseUrl}/auth/callback?next=/first-access`;

  try {
    const admin = createAdminClient();
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        data: fullName ? { full_name: fullName } : undefined,
        redirectTo,
      }
    );

    if (inviteError) {
      const msg = inviteError.message.toLowerCase();
      if (
        msg.includes('already') ||
        msg.includes('registered') ||
        msg.includes('exists')
      ) {
        // Auth ya tiene cuenta reutilizable: flujo segunda farmacia (V2), nunca HTML antiguo.
        const sent = await sendExistingUserPharmacyInviteEmail({
          to: email,
          pharmacyName,
          appBaseUrl,
          recipientName: fullName,
        });
        if (!sent.ok) {
          return { ok: false, error: sent.error };
        }

        const now = new Date().toISOString();
        await supabase
          .from('pharmacy_memberships')
          .update({
            invited_at: now,
            updated_by: auth.actorId,
            updated_at: now,
          })
          .eq('id', membershipId)
          .eq('pharmacy_id', pharmacyId)
          .eq('status', 'invited');

        revalidatePath(`/farmacias/${pharmacyId}`);
        return {
          ok: true,
          message: `Invitación reenviada: se ha notificado el acceso a ${pharmacyName}.`,
        };
      }

      console.error('[membership] resend invite', inviteError.message);
      return {
        ok: false,
        error: 'No se ha podido reenviar la invitación por email.',
      };
    }
  } catch (err) {
    console.error('[membership] resend admin client', err);
    return {
      ok: false,
      error:
        'No se ha podido reenviar la invitación (configuración Admin incompleta).',
    };
  }

  const now = new Date().toISOString();
  const { error: touchError } = await supabase
    .from('pharmacy_memberships')
    .update({
      invited_at: now,
      updated_by: auth.actorId,
      updated_at: now,
    })
    .eq('id', membershipId)
    .eq('pharmacy_id', pharmacyId)
    .eq('status', 'invited');

  if (touchError) {
    console.error('[membership] resend touch', touchError.message);
  }

  revalidatePath(`/farmacias/${pharmacyId}`);
  return {
    ok: true,
    message: 'Invitación reenviada por email (alta de usuario nuevo).',
  };
}

/**
 * Volver a invitar: revoked → invited vía RPC `reinvite` (migración 025).
 * Misma auth.users / profile / membership. Luego email V2.
 * Si el email falla tras el cambio de estado: éxito parcial con mensaje claro.
 */
export async function reinvitePharmacyMembershipAction(input: {
  pharmacyId: string;
  membershipId: string;
}): Promise<MembershipLifecycleResult> {
  const pharmacyId = input.pharmacyId?.trim() ?? '';
  const membershipId = input.membershipId?.trim() ?? '';
  if (!pharmacyId || !membershipId) {
    return { ok: false, error: 'Datos de membresía no válidos.' };
  }

  const auth = await requireSuperAdminUsersWrite();
  if (!auth.ok) return auth;

  const loaded = await loadMembershipForPharmacy(pharmacyId, membershipId);
  if (!loaded.ok) return loaded;

  if (loaded.membership.status !== 'revoked') {
    return {
      ok: false,
      error: 'Solo se puede volver a invitar a un usuario con acceso revocado.',
      code: 'invalid_state',
    };
  }

  const transition = await transitionMembershipViaRpc({
    pharmacyId,
    membershipId,
    action: 'reinvite',
    successMessage: 'Invitación creada. El usuario vuelve a estar pendiente de acceso.',
  });

  if (!transition.ok) {
    return transition;
  }

  const appBaseUrl = getAppBaseUrl();
  if (!appBaseUrl) {
    return {
      ok: true,
      message:
        'La invitación se ha creado, pero no se ha podido enviar el correo. Puedes volver a enviarlo.',
    };
  }

  const supabase = createClient();
  const { data: pharmacy } = await supabase
    .from('pharmacies')
    .select('name')
    .eq('id', pharmacyId)
    .maybeSingle();
  const pharmacyName =
    typeof pharmacy?.name === 'string' && pharmacy.name.trim()
      ? pharmacy.name.trim()
      : 'tu farmacia';

  const sent = await sendExistingUserPharmacyInviteEmail({
    to: loaded.membership.email,
    pharmacyName,
    appBaseUrl,
    recipientName: loaded.membership.fullName,
  });

  if (!sent.ok) {
    console.error('[membership] reinvite email', sent.error);
    return {
      ok: true,
      message:
        'La invitación se ha creado, pero no se ha podido enviar el correo. Puedes volver a enviarlo.',
    };
  }

  return {
    ok: true,
    message: `Invitación creada y enviada para acceder a ${pharmacyName}.`,
  };
}

/**
 * Enviar acceso / Restablecer contraseña (active | suspended).
 * No modifica membership ni status. Dispara recovery Auth (SMTP de Auth).
 */
export async function sendPasswordResetForMembershipAction(input: {
  pharmacyId: string;
  membershipId: string;
}): Promise<MembershipLifecycleResult> {
  const pharmacyId = input.pharmacyId?.trim() ?? '';
  const membershipId = input.membershipId?.trim() ?? '';
  if (!pharmacyId || !membershipId) {
    return { ok: false, error: 'Datos de membresía no válidos.' };
  }

  const auth = await requireSuperAdminUsersWrite();
  if (!auth.ok) return auth;

  const loaded = await loadMembershipForPharmacy(pharmacyId, membershipId);
  if (!loaded.ok) return loaded;

  if (
    loaded.membership.status !== 'active' &&
    loaded.membership.status !== 'suspended'
  ) {
    return {
      ok: false,
      error:
        'Solo se puede enviar acceso o restablecer contraseña a usuarios activos o suspendidos.',
      code: 'invalid_state',
    };
  }

  const result = await requestPasswordRecoveryEmail(loaded.membership.email);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    message:
      'Se ha enviado un enlace para establecer o restablecer la contraseña al email del usuario.',
  };
}

const ALLOWED_EDIT_ROLE_KEYS: PharmacyRoleKey[] = [
  'PHARMACY_OWNER',
  'PHARMACY_ADMIN',
  'PHARMACIST',
  'STAFF',
];

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export type EditPharmacyUserResult =
  | {
      ok: true;
      message: string;
      emailChanged: boolean;
      /** true si la membership sigue invited y el email cambió → conviene reenviar */
      suggestResendInvitation: boolean;
    }
  | {
      ok: false;
      error: string;
      code?: 'last_active_owner' | 'email_taken' | 'invalid_state';
    };

/**
 * Corrige nombre, email (Auth Admin) y/o rol de una membership concreta.
 * No cambia profile_id ni auth user id. No recrea memberships. No toca otras farmacias.
 */
export async function editPharmacyUserAction(input: {
  pharmacyId: string;
  membershipId: string;
  fullName: string;
  email: string;
  roleKey: string;
}): Promise<EditPharmacyUserResult> {
  const pharmacyId = input.pharmacyId?.trim() ?? '';
  const membershipId = input.membershipId?.trim() ?? '';
  const fullName = input.fullName?.trim() ?? '';
  const email = (input.email?.trim() ?? '').toLowerCase();
  const roleKey = input.roleKey?.trim() ?? '';

  if (!pharmacyId || !membershipId) {
    return { ok: false, error: 'Datos de membresía no válidos.' };
  }
  if (!fullName) {
    return { ok: false, error: 'El nombre es obligatorio.' };
  }
  if (!email || !isValidEmail(email)) {
    return { ok: false, error: 'El email no es válido.' };
  }
  if (!ALLOWED_EDIT_ROLE_KEYS.includes(roleKey as PharmacyRoleKey)) {
    return { ok: false, error: 'Selecciona un rol válido.' };
  }

  const auth = await requireSuperAdminUsersWrite();
  if (!auth.ok) return auth;

  const loaded = await loadMembershipForPharmacy(pharmacyId, membershipId);
  if (!loaded.ok) return loaded;

  const membership = loaded.membership;
  const profileId = membership.profileId;
  const emailChanged = email !== membership.email.toLowerCase();
  const nameChanged = fullName !== (membership.fullName?.trim() ?? '');
  const roleChanged = roleKey !== membership.roleKey;

  if (!emailChanged && !nameChanged && !roleChanged) {
    return {
      ok: true,
      message: 'No había cambios que guardar.',
      emailChanged: false,
      suggestResendInvitation: false,
    };
  }

  // Democión del último PHARMACY_OWNER activo → bloquear.
  if (
    roleChanged &&
    membership.status === 'active' &&
    membership.roleKey === 'PHARMACY_OWNER' &&
    roleKey !== 'PHARMACY_OWNER'
  ) {
    const lastOwner = await wouldRemoveLastActiveOwner(pharmacyId, membership);
    if (lastOwner.blocked) {
      return {
        ok: false,
        error:
          lastOwner.error ??
          'No se puede quitar el rol de propietario al último propietario activo. Asigna antes otro propietario a esta farmacia.',
        code: 'last_active_owner',
      };
    }
  }

  const supabase = createClient();

  // Rol de esta membership (no afecta otras farmacias).
  let newRoleId: string | null = null;
  if (roleChanged) {
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, key')
      .eq('key', roleKey)
      .maybeSingle();

    if (roleError || !role) {
      return { ok: false, error: 'El rol seleccionado no existe.' };
    }
    newRoleId = role.id as string;
  }

  // Email: comprobar que no pertenece a otro profile / Auth user.
  if (emailChanged) {
    const { data: emailOwner, error: emailLookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .neq('id', profileId)
      .maybeSingle();

    if (emailLookupError) {
      console.error('[membership] edit email lookup', emailLookupError.message);
      return {
        ok: false,
        error: 'No se ha podido comprobar si el email ya está en uso.',
      };
    }
    if (emailOwner) {
      return {
        ok: false,
        error:
          'Ese email ya pertenece a otro usuario de FarmaFácil. No se puede reasignar.',
        code: 'email_taken',
      };
    }

    try {
      const admin = createAdminClient();
      const { data: authUser, error: getUserError } =
        await admin.auth.admin.getUserById(profileId);

      if (getUserError || !authUser?.user) {
        console.error(
          '[membership] edit getUserById',
          getUserError?.message
        );
        return {
          ok: false,
          error: 'No se ha encontrado el usuario de autenticación.',
        };
      }

      // Admin API: confirma el email en Auth para no dejar limbo de confirmación
      // ni forzar un flujo email_confirm:false / "confirma tu email" ajeno.
      // Mantiene el mismo auth user id (no crea otro usuario).
      const { error: updateAuthError } = await admin.auth.admin.updateUserById(
        profileId,
        {
          email,
          email_confirm: true,
          user_metadata: {
            ...(authUser.user.user_metadata ?? {}),
            full_name: fullName,
          },
        }
      );

      if (updateAuthError) {
        const msg = updateAuthError.message.toLowerCase();
        if (
          msg.includes('already') ||
          msg.includes('registered') ||
          msg.includes('exists') ||
          msg.includes('duplicate')
        ) {
          return {
            ok: false,
            error:
              'Ese email ya está registrado en Auth para otro usuario. No se puede reasignar.',
            code: 'email_taken',
          };
        }
        console.error('[membership] edit updateUserById', updateAuthError.message);
        return {
          ok: false,
          error: 'No se ha podido actualizar el email de autenticación.',
        };
      }
    } catch (err) {
      console.error('[membership] edit admin client', err);
      return {
        ok: false,
        error:
          'No se ha podido actualizar el email (configuración Admin incompleta).',
      };
    }
  }

  // Si solo cambia el nombre, alinear también user_metadata en Auth (sin tocar email).
  if (nameChanged && !emailChanged) {
    try {
      const admin = createAdminClient();
      const { data: authUser } = await admin.auth.admin.getUserById(profileId);
      if (authUser?.user) {
        await admin.auth.admin.updateUserById(profileId, {
          user_metadata: {
            ...(authUser.user.user_metadata ?? {}),
            full_name: fullName,
          },
        });
      }
    } catch (err) {
      console.error('[membership] edit name metadata', err);
      // No bloqueamos: profiles.full_name es la fuente mostrada en la app.
    }
  }

  // Perfil de aplicación: nombre + email (email también lo sincroniza el trigger Auth→profiles).
  const profilePatch: Record<string, unknown> = {};
  if (nameChanged) profilePatch.full_name = fullName;
  if (emailChanged) profilePatch.email = email;

  if (Object.keys(profilePatch).length > 0) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update(profilePatch)
      .eq('id', profileId);

    if (profileError) {
      console.error('[membership] edit profile', profileError.code, profileError.message);
      if (profileError.code === '23505') {
        return {
          ok: false,
          error:
            'Ese email ya pertenece a otro usuario de FarmaFácil. No se puede reasignar.',
          code: 'email_taken',
        };
      }
      return {
        ok: false,
        error:
          emailChanged
            ? 'El email de Auth se actualizó, pero no se ha podido sincronizar el perfil. Revisa el usuario.'
            : 'No se ha podido actualizar el nombre del usuario.',
      };
    }
  } else if (emailChanged === false && nameChanged === false && roleChanged) {
    // solo rol: nada en profile
  }

  if (roleChanged && newRoleId) {
    const now = new Date().toISOString();
    const { data: updatedMembership, error: membershipError } = await supabase
      .from('pharmacy_memberships')
      .update({
        role_id: newRoleId,
        updated_by: auth.actorId,
        updated_at: now,
      })
      .eq('id', membershipId)
      .eq('pharmacy_id', pharmacyId)
      .select('id')
      .maybeSingle();

    if (membershipError) {
      console.error(
        '[membership] edit role',
        membershipError.code,
        membershipError.message
      );
      return {
        ok: false,
        error: 'No se ha podido actualizar el rol en esta farmacia.',
      };
    }
    if (!updatedMembership?.id) {
      return {
        ok: false,
        error: 'La membresía ha cambiado. Recarga e inténtalo de nuevo.',
        code: 'invalid_state',
      };
    }
  }

  revalidatePath(`/farmacias/${pharmacyId}`);

  const suggestResendInvitation =
    emailChanged && membership.status === 'invited';

  const parts: string[] = [];
  if (nameChanged) parts.push('nombre');
  if (emailChanged) parts.push('email');
  if (roleChanged) parts.push('rol');

  let message = `Usuario actualizado (${parts.join(', ')}).`;
  if (suggestResendInvitation) {
    message +=
      ' El email de la invitación pendiente ha cambiado: usa «Reenviar invitación» para enviarla al email correcto.';
  }

  return {
    ok: true,
    message,
    emailChanged,
    suggestResendInvitation,
  };
}
