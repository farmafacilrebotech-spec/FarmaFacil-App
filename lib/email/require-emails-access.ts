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

/**
 * Acceso al hub de emails: solo PLATFORM_SUPERADMIN.
 * Tras 075, SuperAdmin tiene platform.emails.*; Support nunca.
 * mode write/read se documenta para Fase B (send) — hoy el gate es el rol SA.
 */
export async function requireEmailsAccess(
  mode: 'read' | 'write' = 'read'
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

  // Defensa en profundidad si 075 ya está aplicada: exigir permiso concreto.
  // Si el permiso no existe aún (false sin error de RPC tipico), SuperAdmin sigue.
  const permissionKey =
    mode === 'write' ? 'platform.emails.write' : 'platform.emails.read';
  const perm = await hasPlatformPermission(permissionKey);
  if (perm.error) {
    // fallo de infra → no bloquear SuperAdmin en Fase A
    return { ok: true, profile };
  }
  // Si el permiso existe en BD y el grant está, ok=true; si falta 075, ok=false
  // pero el rol SA ya autorizó arriba. No denegamos por false: evita bloqueo pre-075.
  void perm;
  return { ok: true, profile };
}
