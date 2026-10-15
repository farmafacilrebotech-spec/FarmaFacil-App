/**
 * Espejo de la lógica de rate-limit de pairing (036) — testeable sin BD.
 */

export const PAIRING_RATE_WINDOW_MS = 15 * 60 * 1000;
export const PAIRING_RATE_MAX_ATTEMPTS = 8;
export const PAIRING_RATE_BLOCK_MS = 15 * 60 * 1000;

export type PairingRateBucket = {
  windowStartedAt: number;
  attemptCount: number;
  blockedUntil: number | null;
};

export function pairingRateCheck(
  bucket: PairingRateBucket | null,
  nowMs: number
): { allowed: boolean; bucket: PairingRateBucket } {
  if (!bucket) {
    return {
      allowed: true,
      bucket: {
        windowStartedAt: nowMs,
        attemptCount: 0,
        blockedUntil: null,
      },
    };
  }

  if (bucket.blockedUntil != null && bucket.blockedUntil > nowMs) {
    return { allowed: false, bucket };
  }

  let next = bucket;
  if (bucket.windowStartedAt + PAIRING_RATE_WINDOW_MS < nowMs) {
    next = {
      windowStartedAt: nowMs,
      attemptCount: 0,
      blockedUntil: null,
    };
  }

  return { allowed: true, bucket: next };
}

export function pairingRateFail(
  bucket: PairingRateBucket,
  nowMs: number
): PairingRateBucket {
  const attemptCount = bucket.attemptCount + 1;
  return {
    ...bucket,
    attemptCount,
    blockedUntil:
      attemptCount >= PAIRING_RATE_MAX_ATTEMPTS
        ? nowMs + PAIRING_RATE_BLOCK_MS
        : bucket.blockedUntil,
  };
}

/** Mensaje homogéneo al cliente (sin filtrar existencia de código / farmacia). */
export const PAIRING_GENERIC_FAILURE_MESSAGE =
  'Código no válido, caducado o ya utilizado. Solicita uno nuevo en el panel de la farmacia.';
