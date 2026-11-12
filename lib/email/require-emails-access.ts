import {
  getCurrentProfile,
  hasPlatformPermission,
  hasPlatformSuperAdminRole,
  type CurrentProfile,
} from '@/lib/auth/platform';

export type EmailsAccessOk = {
  ok: true;
  profile: CurrentProfile;
};

export type EmailsAccessDenied = {
  ok: false;
  reason: 'unauthenticated' | 'forbidden' | 'error';
  message?: string;
};

export type EmailsAccessMode = 'read' | 'write' | 'send';

/**
 * Acceso hub emails: SuperAdmin + permiso platform.emails.*.
 * mode=send exige platform.emails.send de forma estricta.
 */
export async function requireEmailsAccess(
  mode: EmailsAccessMode = 'read'
): Promise<EmailsAccessOk | EmailsAccessDenied> {
  const { profile, authenticated, error } = await getCurrentProfile();
  if (!authenticated) {
    return { ok: false, reason: 'unauthenticated' };
  }
  if (error || !profile) {
    return { ok: false, reason: 'error', message: error };
  }

  const sa = await hasPlatformSuperAdminRole(profile.id);
  if (!sa.ok) {
    return { ok: false, reason: 'forbidden' };
  }

  const permissionKey =
    mode === 'send'
      ? 'platform.emails.send'
      : mode === 'write'
        ? 'platform.emails.write'
        : 'platform.emails.read';

  const perm = await hasPlatformPermission(permissionKey);
  if (mode === 'send') {
    if (perm.error || !perm.ok) {
      return {
        ok: false,
        reason: 'forbidden',
        message: 'Falta permiso platform.emails.send.',
      };
    }
    return { ok: true, profile };
  }

  if (perm.error) {
    // fallo infra en read/write: SuperAdmin no bloqueado
    return { ok: true, profile };
  }
  void perm;
  return { ok: true, profile };
}
