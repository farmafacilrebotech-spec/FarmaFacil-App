'use server';

import { requestPasswordRecoveryEmail } from '@/lib/auth/password-recovery';

export type ForgotPasswordActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Solicitud pública de recuperación.
 * Respuesta genérica si Auth acepta la petición (no revela existencia de cuenta).
 * Errores técnicos / rate limit se muestran sin fingir éxito.
 */
export async function requestForgotPasswordAction(
  email: string
): Promise<ForgotPasswordActionResult> {
  const result = await requestPasswordRecoveryEmail(email);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    message:
      'Si existe una cuenta asociada a este email, recibirás un enlace para restablecer tu contraseña.',
  };
}
