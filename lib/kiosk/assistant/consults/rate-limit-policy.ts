/**
 * Espejo de límites SQL (B3) — testeable sin base de datos.
 * Los conteos reales y la atomicidad viven en create_consult (FOR UPDATE del turno).
 */

export const CONSULT_RATE_LIMITS = {
  maxPerTurn: 5,
  maxPerDeviceHour: 20,
  maxPerPharmacyHour: 200,
} as const;

export type ConsultRateLimitScope = 'turn' | 'device' | 'pharmacy';

export function evaluateConsultCreateRateLimit(input: {
  countTurn: number;
  countDeviceHour: number;
  countPharmacyHour: number;
}):
  | { ok: true }
  | { ok: false; scope: ConsultRateLimitScope; limit: number } {
  if (input.countTurn >= CONSULT_RATE_LIMITS.maxPerTurn) {
    return {
      ok: false,
      scope: 'turn',
      limit: CONSULT_RATE_LIMITS.maxPerTurn,
    };
  }
  if (input.countDeviceHour >= CONSULT_RATE_LIMITS.maxPerDeviceHour) {
    return {
      ok: false,
      scope: 'device',
      limit: CONSULT_RATE_LIMITS.maxPerDeviceHour,
    };
  }
  if (input.countPharmacyHour >= CONSULT_RATE_LIMITS.maxPerPharmacyHour) {
    return {
      ok: false,
      scope: 'pharmacy',
      limit: CONSULT_RATE_LIMITS.maxPerPharmacyHour,
    };
  }
  return { ok: true };
}

export function rateLimitUserMessage(scope: ConsultRateLimitScope): string {
  switch (scope) {
    case 'turn':
      return 'Has enviado el máximo de consultas en esta sesión. Acércate al mostrador o inicia una nueva conversación.';
    case 'device':
      return 'Este kiosko ha enviado demasiadas consultas. Espera un rato o pregunta en el mostrador.';
    case 'pharmacy':
      return 'La farmacia ha recibido demasiadas consultas. Inténtalo más tarde o acude al mostrador.';
    default:
      return 'Se ha alcanzado el límite de consultas. Acude al mostrador.';
  }
}
