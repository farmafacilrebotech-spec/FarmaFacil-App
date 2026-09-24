import { createClient } from '@/lib/supabase/server';

/**
 * URL pública de la app (nunca desde el navegador).
 * En producción exige NEXT_PUBLIC_APP_URL / APP_URL y rechaza localhost.
 */
export function getPasswordRecoveryAppUrl(): string | null {
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

export type PasswordRecoveryRequestResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      code?: 'not_configured' | 'rate_limit' | 'technical';
    };

/**
 * Dispara el email de recuperación vía Supabase Auth (SMTP de Auth).
 * Compartido por /forgot-password y la acción SuperAdmin.
 *
 * No revela si el email existe: Auth suele devolver éxito genérico.
 * Los errores técnicos / rate limit NO se convierten en éxito.
 */
export async function requestPasswordRecoveryEmail(
  rawEmail: string
): Promise<PasswordRecoveryRequestResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'El email no es válido.', code: 'technical' };
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

  const redirectTo = `${appUrl}/auth/recovery`;

  try {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      console.error('[password-recovery] resetPasswordForEmail', error.message);

      if (
        msg.includes('rate') ||
        msg.includes('too many') ||
        msg.includes('limit')
      ) {
        return {
          ok: false,
          error:
            'Se han enviado demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.',
          code: 'rate_limit',
        };
      }

      return {
        ok: false,
        error:
          'No se ha podido iniciar la recuperación de contraseña. Inténtalo de nuevo más tarde.',
        code: 'technical',
      };
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
