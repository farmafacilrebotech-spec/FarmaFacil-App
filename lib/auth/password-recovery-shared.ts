/**
 * Utilidades puras de recuperación de contraseña (sin I/O).
 * Compartidas por cliente (forgot-password) y servidor (SuperAdmin).
 */

export function buildPasswordRecoveryRedirectTo(appOrigin: string): string {
  const base = appOrigin.replace(/\/$/, '');
  return `${base}/auth/recovery`;
}

export function isValidRecoveryEmail(raw: string): boolean {
  const email = raw.trim().toLowerCase();
  return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

export type PasswordRecoveryErrorCode =
  | 'not_configured'
  | 'rate_limit'
  | 'technical'
  | 'validation';

export function mapPasswordRecoveryAuthError(
  message: string
): { error: string; code: PasswordRecoveryErrorCode } {
  const msg = message.toLowerCase();
  if (
    msg.includes('rate') ||
    msg.includes('too many') ||
    msg.includes('limit')
  ) {
    return {
      error:
        'Se han enviado demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.',
      code: 'rate_limit',
    };
  }
  return {
    error:
      'No se ha podido iniciar la recuperación de contraseña. Inténtalo de nuevo más tarde.',
    code: 'technical',
  };
}

export const RECOVERY_REQUEST_SUCCESS_MESSAGE =
  'Si existe una cuenta asociada a este email, recibirás un enlace para restablecer tu contraseña.';

/**
 * ¿La URL de /auth/recovery trae material de Auth (query o fragment)?
 * Debe evaluarse ANTES de createBrowserClient (puede consumir el hash).
 */
export function recoveryUrlHasAuthMaterial(input: {
  search: string;
  hash: string;
}): boolean {
  const params = new URLSearchParams(
    input.search.startsWith('?') ? input.search.slice(1) : input.search
  );
  if (
    params.get('code') ||
    params.get('token_hash') ||
    params.get('tokenHash')
  ) {
    return true;
  }
  const hash = input.hash.startsWith('#') ? input.hash.slice(1) : input.hash;
  if (!hash) return false;
  const hp = new URLSearchParams(hash);
  return Boolean(
    hp.get('access_token') ||
      hp.get('type') === 'recovery' ||
      hash.includes('access_token')
  );
}
