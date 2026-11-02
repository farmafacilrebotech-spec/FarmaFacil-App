/**
 * Rutas de retorno de cuenta cliente (sin I/O).
 * Usado para adaptar UI de recuperación sin tocar el acceso farmacia.
 */

const CUSTOMER_AUDIENCE_KEY = 'ff_auth_audience';

export function isCustomerAccountReturnPath(
  next: string | null | undefined
): boolean {
  if (!next) return false;
  const p = next.trim();
  if (p === '/cuenta' || p.startsWith('/cuenta/')) return true;
  return /^\/e\/[^/]+\/cuenta(\/|$)/.test(p);
}

export function customerLoginPathFromReturn(
  next: string | null | undefined
): string {
  if (!next) return '/cuenta/entrar';
  const m = next.trim().match(/^(\/e\/[^/]+)\/cuenta/);
  if (m) return `${m[1]}/cuenta/entrar`;
  return '/cuenta/entrar';
}

export function rememberCustomerAuthAudience(): void {
  try {
    sessionStorage.setItem(CUSTOMER_AUDIENCE_KEY, 'customer');
  } catch {
    /* ignore */
  }
}

export function clearCustomerAuthAudience(): void {
  try {
    sessionStorage.removeItem(CUSTOMER_AUDIENCE_KEY);
  } catch {
    /* ignore */
  }
}

export function isRememberedCustomerAuthAudience(): boolean {
  try {
    return sessionStorage.getItem(CUSTOMER_AUDIENCE_KEY) === 'customer';
  } catch {
    return false;
  }
}
