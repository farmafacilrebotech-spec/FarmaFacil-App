/**
 * Destino tras signInWithPassword en el cliente.
 *
 * Importante: no llamar a un server action inmediatamente después del sign-in
 * (las cookies SSR pueden no estar visibles aún). Navegar con document request
 * a /auth/continue para que middleware + RSC lean la sesión ya persistida.
 */

export function resolveClientPostLoginPath(safeNext: string | null): string {
  if (
    safeNext &&
    safeNext.startsWith('/') &&
    !safeNext.startsWith('//') &&
    (safeNext.startsWith('/f/') ||
      safeNext === '/first-access' ||
      safeNext === '/auth/continue' ||
      safeNext === '/auth/select-pharmacy' ||
      safeNext === '/auth/invitations')
  ) {
    return safeNext;
  }
  return '/auth/continue';
}

/** Solo paths internos seguros desde ?next= en /login. */
export function sanitizeLoginNextParam(next: string | null): string | null {
  if (!next) return null;
  if (!next.startsWith('/') || next.startsWith('//')) return null;
  if (
    next.startsWith('/f/') ||
    next === '/first-access' ||
    next === '/auth/continue' ||
    next === '/auth/select-pharmacy' ||
    next === '/auth/invitations'
  ) {
    return next;
  }
  return null;
}
