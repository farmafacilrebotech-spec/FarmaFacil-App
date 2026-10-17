'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAppBaseUrl } from '@/lib/auth/app-url';
import {
  sendExistingUserPharmacyInviteEmail,
  sendNewUserPharmacyInviteEmail,
} from '@/lib/email/pharmacy-invitation';
import { preparePharmacyInviteAuthLink } from '@/lib/pharmacies/invite-auth';
import { findMembershipByEmailInPharmacy } from '@/lib/pharmacies/invite-membership-lookup';
import type { PharmacyRoleKey } from '@/lib/pharmacies/types';
import { requirePharmacyMembershipManage } from '@/lib/pharmacies/membership-authz';
import { canAssignRole } from '@/lib/pharmacies/membership-hierarchy';

export type InvitePharmacyUserResult =
  | {
      ok: true;
      membershipId: string;
      /** true solo si Resend confirmó el envío */
      invitationEmailSent: boolean;
      /** new = primer acceso; existing = magic link a invitaciones */
      inviteKind: 'new' | 'existing';
    }
  | {
      ok: false;
      error: string;
      code?: 'auth_ok_membership_failed' | 'already_member' | 'email_failed';
      existingStatus?: string;
    };

const ALLOWED_ROLE_KEYS: PharmacyRoleKey[] = [
  'PHARMACY_OWNER',
  'PHARMACY_ADMIN',
  'PHARMACIST',
  'STAFF',
];

const MEMBERSHIP_STATUS_MESSAGES: Record<string, string> = {
  invited:
    'Este email ya tiene una invitación pendiente en esta farmacia.',
  active: 'Este email ya es miembro activo de esta farmacia.',
  suspended:
    'Este email pertenece a un miembro suspendido de esta farmacia.',
  revoked:
    'Este email pertenece a un miembro con acceso revocado en esta farmacia.',
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Inserta membership invited. Reintenta si el perfil aún no existe
 * (trigger on auth.users) — sin SELECT sobre profiles (RLS).
 */
async function insertMembershipWithProfileRetry(params: {
  supabase: ReturnType<typeof createClient>;
  pharmacyId: string;
  profileId: string;
  roleId: string;
  actorId: string;
}): Promise<{ ok: true; membershipId: string } | { ok: false; error: string }> {
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < 6; attempt++) {
    const { data, error } = await params.supabase
      .from('pharmacy_memberships')
      .insert({
        pharmacy_id: params.pharmacyId,
        profile_id: params.profileId,
        role_id: params.roleId,
        status: 'invited',
        invited_by: params.actorId,
        updated_by: params.actorId,
        invited_at: now,
      })
      .select('id')
      .maybeSingle();

    if (!error && data?.id) {
      return { ok: true, membershipId: data.id as string };
    }

    if (error) {
      console.error(
        '[invite] membership insert',
        error.code,
        error.message,
        `attempt=${attempt + 1}`
      );

      if (error.code === '42501') {
        return {
          ok: false,
          error: 'No tienes permiso para gestionar usuarios de farmacia.',
        };
      }
      if (error.code === '23505') {
        return {
          ok: false,
          error: 'Este usuario ya tiene una membresía en esta farmacia.',
        };
      }
      // FK: perfil aún no materializado por el trigger
      if (error.code === '23503' && attempt < 5) {
        await sleep(150 * (attempt + 1));
        continue;
      }

      return {
        ok: false,
        error: 'No se ha podido registrar el acceso a la farmacia.',
      };
    }

    await sleep(150 * (attempt + 1));
  }

  return {
    ok: false,
    error: 'No se ha podido registrar el acceso a la farmacia.',
  };
}

/**
 * Invita a un usuario a una farmacia.
 *
 * Autorización: SuperAdmin (platform.users.write) O memberships.manage
 * (OWNER/ADMIN) + jerarquía de roles + farmacia operable.
 *
 * Auth Admin: solo generateLink (no inviteUserByEmail SMTP).
 * Membership: cliente autenticado + RLS. No requiere SELECT del perfil nuevo.
 * Email: Resend con token_hash hacia el dominio canónico.
 */
export async function invitePharmacyUserAction(input: {
  pharmacyId: string;
  fullName: string;
  email: string;
  roleKey: string;
}): Promise<InvitePharmacyUserResult> {
  const pharmacyId = input.pharmacyId?.trim() ?? '';
  const fullName = input.fullName?.trim() ?? '';
  const email = (input.email?.trim() ?? '').toLowerCase();
  const roleKey = input.roleKey?.trim() ?? '';

  if (!pharmacyId) {
    return { ok: false, error: 'Farmacia no válida.' };
  }
  if (!fullName) {
    return { ok: false, error: 'El nombre es obligatorio.' };
  }
  if (!email || !isValidEmail(email)) {
    return { ok: false, error: 'El email no es válido.' };
  }
  if (!ALLOWED_ROLE_KEYS.includes(roleKey as PharmacyRoleKey)) {
    return { ok: false, error: 'Selecciona un rol válido.' };
  }

  const auth = await requirePharmacyMembershipManage(pharmacyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  if (!canAssignRole(auth.actor, roleKey as PharmacyRoleKey)) {
    return {
      ok: false,
      error: 'No puedes asignar ese rol con tu nivel de acceso.',
    };
  }

  const supabase = createClient();

  const { data: pharmacy, error: pharmacyError } = await supabase
    .from('pharmacies')
    .select('id, name')
    .eq('id', pharmacyId)
    .maybeSingle();

  if (pharmacyError || !pharmacy) {
    return { ok: false, error: 'No se ha encontrado la farmacia.' };
  }

  const pharmacyName =
    typeof pharmacy.name === 'string' && pharmacy.name.trim()
      ? pharmacy.name.trim()
      : 'tu farmacia';

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id, key')
    .eq('key', roleKey)
    .maybeSingle();

  if (roleError || !role) {
    return { ok: false, error: 'El rol seleccionado no existe.' };
  }

  // Duplicado en ESTA farmacia.
  // FK explícita a profile_id: pharmacy_memberships tiene varias FK a profiles
  // (profile_id, invited_by, updated_by). `profiles!inner` sin hint falla en
  // PostgREST (embed ambiguo) → error «No se ha podido comprobar la membresía…».
  // Misma convención que listPharmacyMembers.
  const { data: membershipRows, error: memLookupError } = await supabase
    .from('pharmacy_memberships')
    .select(
      `
      id,
      status,
      profiles!pharmacy_memberships_profile_id_fkey (
        email
      )
    `
    )
    .eq('pharmacy_id', pharmacyId);

  if (memLookupError) {
    console.error(
      '[invite] membership lookup',
      memLookupError.code,
      memLookupError.message
    );
    return {
      ok: false,
      error: 'No se ha podido comprobar la membresía existente.',
    };
  }

  const existingMembership = findMembershipByEmailInPharmacy(
    membershipRows ?? [],
    email
  );

  if (existingMembership) {
    const status = existingMembership.status;
    return {
      ok: false,
      error:
        MEMBERSHIP_STATUS_MESSAGES[status] ??
        'Este email ya tiene acceso registrado en esta farmacia.',
      code: 'already_member',
      existingStatus: status,
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

  const authLink = await preparePharmacyInviteAuthLink({
    email,
    fullName,
    appBaseUrl,
  });

  if (!authLink.ok) {
    return { ok: false, error: authLink.error };
  }

  const inserted = await insertMembershipWithProfileRetry({
    supabase,
    pharmacyId,
    profileId: authLink.userId,
    roleId: role.id as string,
    actorId: auth.actorId,
  });

  if (!inserted.ok) {
    return {
      ok: false,
      error: `${inserted.error} El usuario de Auth puede haberse preparado; reintenta para completar solo el acceso a la farmacia.`,
      code: 'auth_ok_membership_failed',
    };
  }

  // Email solo tras membership OK. No afirmar envío sin confirmación de Resend.
  let invitationEmailSent = false;
  if (authLink.kind === 'new') {
    const sent = await sendNewUserPharmacyInviteEmail({
      to: email,
      pharmacyName,
      appBaseUrl,
      recipientName: fullName,
      hashedToken: authLink.hashedToken,
      otpType: authLink.otpType,
    });
    invitationEmailSent = sent.ok;
    if (!sent.ok) {
      console.error('[invite] new-user email', sent.error, sent.code);
    }
  } else {
    const sent = await sendExistingUserPharmacyInviteEmail({
      to: email,
      pharmacyName,
      appBaseUrl,
      recipientName: fullName,
      hashedToken: authLink.hashedToken,
      otpType: authLink.otpType,
    });
    invitationEmailSent = sent.ok;
    if (!sent.ok) {
      console.error('[invite] existing-user email', sent.error, sent.code);
    }
  }

  revalidatePath(`/farmacias/${pharmacyId}`);
  revalidatePath(`/f/${pharmacyId}/usuarios`);

  return {
    ok: true,
    membershipId: inserted.membershipId,
    invitationEmailSent,
    inviteKind: authLink.kind,
  };
}
