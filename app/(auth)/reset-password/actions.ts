'use server';

import { createClient } from '@/lib/supabase/server';
import { signOutAndClearCookies } from '@/lib/auth/sign-out';

export type ResetPasswordActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; code?: 'unauthenticated' | 'validation' };

/**
 * Establece la nueva contraseña tras un recovery Auth válido (sesión en cookies).
 * Tras éxito cierra la sesión de recovery por completo (cookies incluidas)
 * para forzar login con la nueva clave y no reutilizar sesión antigua.
 */
export async function resetPasswordAction(input: {
  password: string;
  confirmPassword: string;
}): Promise<ResetPasswordActionResult> {
  const password = input.password ?? '';
  const confirmPassword = input.confirmPassword ?? '';

  if (password.length < 8) {
    return {
      ok: false,
      error: 'La contraseña debe tener al menos 8 caracteres.',
      code: 'validation',
    };
  }
  if (password !== confirmPassword) {
    return {
      ok: false,
      error: 'Las contraseñas no coinciden.',
      code: 'validation',
    };
  }

  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      error:
        'El enlace de recuperación no es válido o ha caducado. Solicita uno nuevo.',
      code: 'unauthenticated',
    };
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password,
  });

  if (passwordError) {
    console.error('[reset-password] updateUser', passwordError.message);
    const msg = passwordError.message.toLowerCase();
    if (msg.includes('same') || msg.includes('identical')) {
      return {
        ok: false,
        error: 'La nueva contraseña debe ser distinta de la anterior.',
        code: 'validation',
      };
    }
    return {
      ok: false,
      error: 'No se ha podido guardar la contraseña. Inténtalo de nuevo.',
    };
  }

  await signOutAndClearCookies();

  return {
    ok: true,
    message: 'Contraseña actualizada. Ya puedes iniciar sesión.',
  };
}
