import { createClient } from '@/lib/supabase/server';

export type CurrentProfile = {
  id: string;
  email: string;
  fullName: string | null;
};

export type PlatformAccessResult =
  | { status: 'unauthenticated' }
  | { status: 'authorized'; profile: CurrentProfile }
  | { status: 'forbidden'; profile: CurrentProfile }
  | { status: 'error'; message: string; email?: string };

/**
 * Comprueba PLATFORM_SUPERADMIN solo vía:
 * platform_user_roles → platform_roles (key).
 * Respeta RLS (el usuario puede leer sus propios roles).
 */
export async function hasPlatformSuperAdminRole(
  profileId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('platform_user_roles')
    .select(
      `
      id,
      platform_roles!inner (
        key
      )
    `
    )
    .eq('profile_id', profileId)
    .eq('platform_roles.key', 'PLATFORM_SUPERADMIN')
    .maybeSingle();

  if (error) {
    console.error('platform role check failed:', error.code, error.message);
    return { ok: false, error: error.message };
  }

  return { ok: data != null };
}

/**
 * Comprueba un permiso de plataforma vía helper SQL ff_has_platform_permission.
 * Usa la sesión del usuario (JWT); no service_role.
 */
export async function hasPlatformPermission(
  permissionKey: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc('ff_has_platform_permission', {
    p_permission_key: permissionKey,
  });

  if (error) {
    console.error(
      'platform permission check failed:',
      error.code,
      error.message
    );
    return { ok: false, error: error.message };
  }

  return { ok: data === true };
}

export async function getCurrentProfile(): Promise<{
  profile: CurrentProfile | null;
  error?: string;
  authenticated: boolean;
}> {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('auth getUser failed:', userError.message);
    return { profile: null, authenticated: false, error: userError.message };
  }

  if (!user) {
    return { profile: null, authenticated: false };
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('profile load failed:', error.code, error.message);
    return {
      profile: null,
      authenticated: true,
      error: error.message,
    };
  }

  if (!profile) {
    return {
      authenticated: true,
      profile: {
        id: user.id,
        email: user.email ?? '',
        fullName: null,
      },
    };
  }

  return {
    authenticated: true,
    profile: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
    },
  };
}

/**
 * Resolución única de acceso al panel de plataforma.
 * Nunca trata un error RBAC como "sin sesión".
 */
export async function resolvePlatformAccess(): Promise<PlatformAccessResult> {
  const { profile, authenticated, error } = await getCurrentProfile();

  if (!authenticated) {
    return { status: 'unauthenticated' };
  }

  if (error || !profile) {
    return {
      status: 'error',
      message: error ?? 'No se ha podido cargar el perfil.',
      email: profile?.email,
    };
  }

  const role = await hasPlatformSuperAdminRole(profile.id);

  if (role.error) {
    return {
      status: 'error',
      message: role.error,
      email: profile.email,
    };
  }

  if (!role.ok) {
    return { status: 'forbidden', profile };
  }

  return { status: 'authorized', profile };
}
