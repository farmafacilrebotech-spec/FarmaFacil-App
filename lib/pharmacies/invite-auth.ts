/**
 * Orquestación Auth Admin para invitaciones (sin enviar email).
 * generateLink + hashed_token → email FarmaFácil (Resend).
 * No depende de SELECT sobre profiles (RLS bloquea perfiles sin membership).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import {
  inviteAuthAlreadyRegistered,
  otpTypeFromVerification,
} from '@/lib/pharmacies/invite-auth-logic';

export {
  classifyAuthCallbackError,
  inviteAuthAlreadyRegistered,
  otpTypeFromVerification,
} from '@/lib/pharmacies/invite-auth-logic';

export type InviteAuthKind = 'new' | 'existing';

export type InviteAuthLink =
  | {
      ok: true;
      kind: InviteAuthKind;
      userId: string;
      hashedToken: string;
      otpType: 'invite' | 'magiclink' | 'email';
      nextPath: string;
    }
  | { ok: false; error: string };

/**
 * Prepara enlace Auth para invitación.
 * - new: generateLink(invite) → /first-access (crea usuario Auth si hace falta)
 * - existing: generateLink(magiclink) → /auth/invitations
 *
 * No envía correo (eso lo hace Resend).
 */
export async function preparePharmacyInviteAuthLink(input: {
  email: string;
  fullName: string;
  appBaseUrl: string;
}): Promise<InviteAuthLink> {
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const firstAccessRedirect = `${input.appBaseUrl}/auth/callback?next=${encodeURIComponent('/first-access')}`;
  const invitationsNext = `/auth/invitations?for=${encodeURIComponent(email)}`;
  const invitationsRedirect = `${input.appBaseUrl}/auth/callback?next=${encodeURIComponent(invitationsNext)}`;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      ok: false,
      error:
        'No se ha podido completar la invitación (configuración Admin incompleta).',
    };
  }

  const inviteAttempt = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
      redirectTo: firstAccessRedirect,
    },
  });

  if (!inviteAttempt.error) {
    const userId = inviteAttempt.data.user?.id;
    const hashedToken = inviteAttempt.data.properties?.hashed_token;
    const verificationType = (
      inviteAttempt.data.properties as { verification_type?: string } | undefined
    )?.verification_type;

    if (!userId || !hashedToken) {
      return {
        ok: false,
        error: 'No se ha podido generar el enlace de invitación.',
      };
    }

    return {
      ok: true,
      kind: 'new',
      userId,
      hashedToken,
      otpType: otpTypeFromVerification(verificationType, 'invite'),
      nextPath: '/first-access',
    };
  }

  if (!inviteAuthAlreadyRegistered(inviteAttempt.error.message)) {
    console.error(
      '[invite-auth] generateLink invite',
      inviteAttempt.error.message
    );
    return {
      ok: false,
      error: 'No se ha podido preparar la invitación de acceso.',
    };
  }

  const magicAttempt = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: invitationsRedirect },
  });

  if (magicAttempt.error) {
    console.error(
      '[invite-auth] generateLink magiclink',
      magicAttempt.error.message
    );
    return {
      ok: false,
      error:
        'No se ha podido preparar el enlace de acceso para el usuario existente.',
    };
  }

  const userId = magicAttempt.data.user?.id;
  const hashedToken = magicAttempt.data.properties?.hashed_token;
  const verificationType = (
    magicAttempt.data.properties as { verification_type?: string } | undefined
  )?.verification_type;

  if (!userId || !hashedToken) {
    return {
      ok: false,
      error: 'No se ha podido generar el enlace de acceso.',
    };
  }

  return {
    ok: true,
    kind: 'existing',
    userId,
    hashedToken,
    otpType: otpTypeFromVerification(verificationType, 'magiclink'),
    nextPath: invitationsNext,
  };
}
