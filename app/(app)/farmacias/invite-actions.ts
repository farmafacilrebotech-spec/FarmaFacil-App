'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAppBaseUrl } from '@/lib/auth/app-url';
import {
  sendExistingUserPharmacyInviteEmail,
  sendNewUserPharmacyInviteEmail,
} from '@/lib/email/pharmacy-invitation';
import { preparePharmacyInviteAuthLink } from '@/lib/pharmacies/invite-auth';
import { resolvePharmacyInviteEmailKind } from '@/lib/pharmacies/invite-auth-logic';
import { resolvePharmacyInviteUserKind } from '@/lib/pharmacies/invite-user-kind';
import {
  inviteBlockMessageForMembership,
  resolveInviteAgainstExistingMembership,
} from '@/lib/pharmacies/membership-invite-state';
import { authFlowDiag } from '@/lib/auth/auth-flow-diag';
import type { PharmacyRoleKey } from '@/lib/pharmacies/types';
import { requirePharmacyMembershipManage } from '@/lib/pharmacies/membership-authz';
import {
  canAssignRole,
  canManageTargetRole,
} from '@/lib/pharmacies/membership-hierarchy';

export type InvitePharmacyUserResult =
  | {
      ok: true;
      membershipId: string;
      /** true solo si Resend confirmó el envío */
      invitationEmailSent: boolean;
      /** new = primer acceso; existing = magic link a invitaciones */
      inviteKind: 'new' | 'existing';
      /** true si se reutilizó una membership revoked (cancelada o baja) */
      reusedMembership?: boolean;
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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Emails de demo local/staging (@farmafacil.test): no enviar Resend
 * y activar membership si la cuenta ya existe (evita SMS/OTP y correos reales).
 */
function isDemoTestEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith('@farmafacil.test');
}

async function activateDemoMembershipWithoutEmail(params: {
  supabase: ReturnType<typeof createClient>;
  pharmacyId: string;
  membershipId: string;
  actorId: string;
}): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await params.supabase
    .from('pharmacy_memberships')
    .update({
      status: 'active',
      accepted_at: now,
      updated_by: params.actorId,
      updated_at: now,
    })
    .eq('id', params.membershipId)
    .eq('pharmacy_id', params.pharmacyId)
    .eq('status', 'invited');

  if (error) {
    console.error('[invite] demo activate', error.code);
    return false;
  }
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
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
 * Membership en ESTA farmacia por profile_id (sin embed de profiles).
 * Necesario tras cancelar/revocar: ff_can_view_profile excluye revoked y el
 * lookup por email con join a profiles falla para actores tenant.
 */
async function findMembershipByProfileInPharmacy(params: {
  supabase: ReturnType<typeof createClient>;
  pharmacyId: string;
  profileId: string;
}): Promise<{
  id: string;
  status: string;
  accepted_at: string | null;
  roleKey: PharmacyRoleKey | null;
  roleId: string | null;
} | null> {
  const { data, error } = await params.supabase
    .from('pharmacy_memberships')
    .select(
      `
      id,
      status,
      accepted_at,
      role_id,
      roles!pharmacy_memberships_role_id_fkey ( key )
    `
    )
    .eq('pharmacy_id', params.pharmacyId)
    .eq('profile_id', params.profileId)
    .maybeSingle();

  if (error) {
    console.error(
      '[invite] membership by profile',
      error.code,
      error.message
    );
    return null;
  }
  if (!data) return null;

  const role = unwrapOne(
    data.roles as { key: string } | { key: string }[] | null
  );
  const roleKey =
    role && ALLOWED_ROLE_KEYS.includes(role.key as PharmacyRoleKey)
      ? (role.key as PharmacyRoleKey)
      : null;

  return {
    id: data.id as string,
    status: data.status as string,
    accepted_at: (data.accepted_at as string | null) ?? null,
    roleKey,
    roleId: (data.role_id as string | null) ?? null,
  };
}

async function transitionReinviteViaRpc(params: {
  supabase: ReturnType<typeof createClient>;
  pharmacyId: string;
  membershipId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await params.supabase.rpc(
    'ff_transition_pharmacy_membership_v1',
    {
      p_pharmacy_id: params.pharmacyId,
      p_membership_id: params.membershipId,
      p_action: 'reinvite',
    }
  );

  if (error) {
    console.error(
      '[invite] reinvite rpc',
      error.code,
      error.message
    );
    const msg = (error.message || '').toLowerCase();
    if (
      msg.includes('forbidden') ||
      msg.includes('permission') ||
      error.code === '42501'
    ) {
      return {
        ok: false,
        error: 'No tienes permiso para gestionar usuarios de farmacia.',
      };
    }
    if (msg.includes('solo se puede volver a invitar') || msg.includes('invalid_state')) {
      return {
        ok: false,
        error:
          'El estado de la membresía ha cambiado. Recarga e inténtalo de nuevo.',
      };
    }
    return {
      ok: false,
      error: 'No se ha podido volver a abrir la invitación.',
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
  if (!payload || String(payload.status) !== 'ok') {
    return {
      ok: false,
      error: 'No se ha podido volver a abrir la invitación.',
    };
  }
  return { ok: true };
}

/**
 * Invita a un usuario a una farmacia.
 *
 * Autorización: SuperAdmin (platform.users.write) O memberships.manage
 * (OWNER/ADMIN) + jerarquía de roles + farmacia operable.
 *
 * Si ya existe membership revoked (invitación cancelada o baja), reutiliza la
 * misma fila vía RPC `reinvite` (revoked→invited). No reactiva a active.
 * Auth Admin: solo generateLink (no inviteUserByEmail SMTP).
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

  const appBaseUrl = getAppBaseUrl();
  if (!appBaseUrl) {
    return {
      ok: false,
      error:
        'Falta una URL de aplicación válida (NEXT_PUBLIC_APP_URL). En producción no se permite localhost.',
    };
  }

  // Auth primero → userId estable. Luego membership por profile_id (sin
  // depender de profiles RLS, que oculta revoked a peers de farmacia).
  // preferFirstAccess provisional: si Auth ya existe, el magiclink irá a
  // first-access; si tras insert/reinvite resulta "existing" FarmaFácil,
  // el email de existing usa next invitations en la plantilla.
  const authLink = await preparePharmacyInviteAuthLink({
    email,
    fullName,
    appBaseUrl,
    preferFirstAccess: true,
  });

  if (!authLink.ok) {
    return { ok: false, error: authLink.error };
  }

  const existing = await findMembershipByProfileInPharmacy({
    supabase,
    pharmacyId,
    profileId: authLink.userId,
  });

  // Si el SELECT falló por error de red, existing es null y el insert puede
  // chocar con 23505; el fallback más abajo intenta reinvite.
  const decision = resolveInviteAgainstExistingMembership(existing);

  if (decision.kind === 'block') {
    return {
      ok: false,
      error: inviteBlockMessageForMembership(
        decision.status,
        decision.acceptedAt
      ),
      code: 'already_member',
      existingStatus: decision.status,
    };
  }

  if (decision.kind === 'reinvite') {
    if (
      existing?.roleKey &&
      !canManageTargetRole(auth.actor, existing.roleKey)
    ) {
      return {
        ok: false,
        error: 'No puedes gestionar el acceso de un usuario con ese rol.',
      };
    }

    // Actualizar rol si el diálogo pide otro (misma fila; sin duplicar).
    if (
      existing &&
      existing.roleId &&
      existing.roleId !== (role.id as string)
    ) {
      const { error: roleUpdateError } = await supabase
        .from('pharmacy_memberships')
        .update({
          role_id: role.id as string,
          updated_by: auth.actorId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', decision.membershipId)
        .eq('pharmacy_id', pharmacyId)
        .eq('status', 'revoked');

      if (roleUpdateError) {
        console.error(
          '[invite] reinvite role update',
          roleUpdateError.code,
          roleUpdateError.message
        );
        return {
          ok: false,
          error: 'No se ha podido actualizar el rol antes de volver a invitar.',
        };
      }
    }

    const transitioned = await transitionReinviteViaRpc({
      supabase,
      pharmacyId,
      membershipId: decision.membershipId,
    });

    if (!transitioned.ok) {
      return { ok: false, error: transitioned.error };
    }

    // Usuario ya tenía cuenta (cancelación / baja): email de farmacia nueva.
    // No conceder active: reinvite deja invited → requiere aceptación.
    // Excepción demo @farmafacil.test: sin correo y membership activa.
    let invitationEmailSent = false;
    if (isDemoTestEmail(email)) {
      await activateDemoMembershipWithoutEmail({
        supabase,
        pharmacyId,
        membershipId: decision.membershipId,
        actorId: auth.actorId,
      });
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
        console.error('[invite] reinvite email', sent.error, sent.code);
      }
    }

    revalidatePath(`/farmacias/${pharmacyId}`);
    revalidatePath(`/f/${pharmacyId}/usuarios`);
    revalidatePath('/auth/invitations');

    return {
      ok: true,
      membershipId: decision.membershipId,
      invitationEmailSent,
      inviteKind: 'existing',
      reusedMembership: true,
    };
  }

  const inserted = await insertMembershipWithProfileRetry({
    supabase,
    pharmacyId,
    profileId: authLink.userId,
    roleId: role.id as string,
    actorId: auth.actorId,
  });

  if (!inserted.ok) {
    // Carrera / lookup fallido: si la fila es revoked, reutilizar.
    if (inserted.error.includes('ya tiene una membresía')) {
      const again = await findMembershipByProfileInPharmacy({
        supabase,
        pharmacyId,
        profileId: authLink.userId,
      });
      const againDecision = resolveInviteAgainstExistingMembership(again);
      if (againDecision.kind === 'reinvite') {
        const transitioned = await transitionReinviteViaRpc({
          supabase,
          pharmacyId,
          membershipId: againDecision.membershipId,
        });
        if (transitioned.ok) {
          const sent = await sendExistingUserPharmacyInviteEmail({
            to: email,
            pharmacyName,
            appBaseUrl,
            recipientName: fullName,
            hashedToken: authLink.hashedToken,
            otpType: authLink.otpType,
          });
          revalidatePath(`/farmacias/${pharmacyId}`);
          revalidatePath(`/f/${pharmacyId}/usuarios`);
          revalidatePath('/auth/invitations');
          return {
            ok: true,
            membershipId: againDecision.membershipId,
            invitationEmailSent: sent.ok,
            inviteKind: 'existing',
            reusedMembership: true,
          };
        }
      }
      if (againDecision.kind === 'block') {
        return {
          ok: false,
          error: inviteBlockMessageForMembership(
            againDecision.status,
            againDecision.acceptedAt
          ),
          code: 'already_member',
          existingStatus: againDecision.status,
        };
      }
    }

    return {
      ok: false,
      error: `${inserted.error} El usuario de Auth puede haberse preparado; reintenta para completar solo el acceso a la farmacia.`,
      code: 'auth_ok_membership_failed',
    };
  }

  // Email solo tras membership OK. No afirmar envío sin confirmación de Resend.
  // Demo @farmafacil.test: sin Resend; si la cuenta ya existe → membership active.
  // Plantilla según memberships FarmaFácil (p.ej. Auth confirmado + solo invited
  // → first-access), no según authLink.kind alone.
  let invitationEmailSent = false;
  const kindResult = await resolvePharmacyInviteUserKind(authLink.userId);
  const emailKind = kindResult.ok
    ? resolvePharmacyInviteEmailKind(kindResult.kind)
    : authLink.kind === 'new'
      ? 'new'
      : 'existing';

  authFlowDiag('invite_created_prepared', {
    email_kind: emailKind,
    auth_link_kind: authLink.kind,
    otp_type: authLink.otpType,
    next_path: authLink.nextPath,
    kind_resolve_ok: kindResult.ok,
  });

  if (isDemoTestEmail(email)) {
    if (emailKind === 'existing') {
      await activateDemoMembershipWithoutEmail({
        supabase,
        pharmacyId,
        membershipId: inserted.membershipId,
        actorId: auth.actorId,
      });
    }
  } else if (emailKind === 'new') {
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
    inviteKind: emailKind,
  };
}
