import { createClient } from '@/lib/supabase/server';
import { getAppBaseUrl } from '@/lib/auth/app-url';
import {
  buildPasswordRecoveryRedirectTo,
  isValidRecoveryEmail,
  mapPasswordRecoveryAuthError,
} from '@/lib/auth/password-recovery-shared';

/** @deprecated Prefer getAppBaseUrl — se mantiene el nombre por callers existentes. */
export function getPasswordRecoveryAppUrl(): string | null {
  return getAppBaseUrl();
}

export type PasswordRecoveryRequestResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      code?: 'not_configured' | 'rate_limit' | 'technical' | 'validation';
    };

/**
 * Dispara el email de recuperación vía Supabase Auth (SMTP de Auth).
 * Pensado para SuperAdmin / server actions.
 *
 * El formulario público /forgot-password debe preferir el cliente browser
 * (PKCE + origin de la pestaña) vía requestPasswordRecoveryFromBrowser.
 *
 * No revela si el email existe: Auth suele devolver éxito genérico.
 * Los errores técnicos / rate limit NO se convierten en éxito.
 */
export async function requestPasswordRecoveryEmail(
  rawEmail: string
): Promise<PasswordRecoveryRequestResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!isValidRecoveryEmail(email)) {
    return {
      ok: false,
      error: 'El email no es válido.',
      code: 'validation',
    };
  }

  const appUrl = getPasswordRecoveryAppUrl();
  if (!appUrl) {
    console.error('[password-recovery] APP URL no configurada');
    return {
      ok: false,
      error:
        'No se ha podido iniciar la recuperación (configuración de URL incompleta).',
      code: 'not_configured',
    };
  }

  const redirectTo = buildPasswordRecoveryRedirectTo(appUrl);

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error('[password-recovery] resetPasswordForEmail', error.message);
      return { ok: false, ...mapPasswordRecoveryAuthError(error.message) };
    }

    return { ok: true };
  } catch (err) {
    console.error('[password-recovery] unexpected', err);
    return {
      ok: false,
      error:
        'No se ha podido iniciar la recuperación de contraseña. Inténtalo de nuevo más tarde.',
      code: 'technical',
    };
  }
}
