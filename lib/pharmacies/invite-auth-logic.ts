/**
 * Helpers puros del flujo de invitación Auth (sin I/O ni path aliases).
 */

export type PharmacyInviteEmailKind = 'new' | 'existing';

/**
 * Plantilla + destino del email según membership FarmaFácil, NO según
 * si Auth generateLink(invite) falló por "already registered".
 *
 * Caso staging típico tras limpieza: Auth confirmado + solo membership
 * invited → membershipKind "new" → email de primer acceso (/first-access),
 * aunque el OTP sea magiclink.
 *
 * Bug anterior: usar authLink.kind como fallback enviaba magiclink a
 * /auth/invitations; sin cookie de sesión esa ruta redirige a /login.
 */
export function resolvePharmacyInviteEmailKind(
  membershipKind: PharmacyInviteEmailKind
): PharmacyInviteEmailKind {
  return membershipKind;
}

/** nextPath del callback según plantilla de email. */
export function inviteEmailNextPath(
  emailKind: PharmacyInviteEmailKind,
  email: string
): string {
  if (emailKind === 'existing') {
    return `/auth/invitations?for=${encodeURIComponent(email.trim().toLowerCase())}`;
  }
  return '/first-access';
}

export function inviteAuthAlreadyRegistered(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes('already') ||
    msg.includes('registered') ||
    msg.includes('exists') ||
    msg.includes('duplicate')
  );
}

/** Clasifica error Auth para mensajes de enlace caducado / usado. */
export function classifyAuthCallbackError(message: string): {
  code: 'otp_expired' | 'otp_used' | 'auth_callback';
} {
  const msg = message.toLowerCase();
  if (
    msg.includes('expired') ||
    msg.includes('otp_expired') ||
    msg.includes('token has expired')
  ) {
    return { code: 'otp_expired' };
  }
  if (
    msg.includes('already been used') ||
    msg.includes('token has already been used') ||
    msg.includes('otp_disabled') ||
    (msg.includes('already') && msg.includes('used'))
  ) {
    return { code: 'otp_used' };
  }
  return { code: 'auth_callback' };
}

export function otpTypeFromVerification(
  verificationType: string | undefined,
  fallback: 'invite' | 'magiclink'
): 'invite' | 'magiclink' | 'email' {
  if (verificationType === 'signup') return 'email';
  if (verificationType === 'invite') return 'invite';
  if (verificationType === 'magiclink' || verificationType === 'email') {
    return verificationType;
  }
  return fallback;
}
