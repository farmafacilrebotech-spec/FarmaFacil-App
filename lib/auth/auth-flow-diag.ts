/**
 * Diagnóstico temporal del flujo Auth (solo local).
 * Activar con FF_AUTH_DIAG=1. Nunca registra tokens, cookies ni secretos.
 */

function diagEnabled(): boolean {
  return process.env.FF_AUTH_DIAG === '1';
}

export function authFlowDiag(
  event: string,
  payload: Record<string, string | boolean | number | null | undefined>
): void {
  if (!diagEnabled()) return;
  const safe: Record<string, string | boolean | number | null> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (
      lower.includes('token') ||
      lower.includes('cookie') ||
      lower.includes('password') ||
      lower.includes('secret') ||
      lower.includes('authorization')
    ) {
      continue;
    }
    safe[key] = value;
  }
  console.info(`[ff-auth-diag] ${event}`, safe);
}
