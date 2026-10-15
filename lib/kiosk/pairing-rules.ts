/**
 * Reglas de dominio del canje (espejo de la RPC 036) — testeables sin BD.
 */

export type PairingCodeRow = {
  pharmacyId: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

export type ConsumeAttemptResult =
  | { ok: true; pharmacyId: string }
  | { ok: false; reason: 'unavailable' };

/**
 * Simula el filtro atómico: hash coincide, no consumido, no caducado,
 * farmacia operable + módulo kiosk. Fallos homogéneos (unavailable).
 */
export function attemptConsumePairingCode(input: {
  submittedHash: string;
  row: PairingCodeRow | null;
  now: Date;
  pharmacyOperable?: boolean;
  hasKioskModule?: boolean;
}): ConsumeAttemptResult {
  const { submittedHash, row, now } = input;
  if (!row) return { ok: false, reason: 'unavailable' };
  if (row.codeHash !== submittedHash) return { ok: false, reason: 'unavailable' };
  if (row.consumedAt != null) return { ok: false, reason: 'unavailable' };
  if (row.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: 'unavailable' };
  }
  // Espejo de ff_kiosk_pharmacy_runtime_allowed (sin import cruzado tsc/node).
  const operable = input.pharmacyOperable ?? true;
  const hasModule = input.hasKioskModule ?? true;
  if (operable !== true || hasModule !== true) {
    return { ok: false, reason: 'unavailable' };
  }
  return { ok: true, pharmacyId: row.pharmacyId };
}

/**
 * Tras consumo, la fila queda marcada; reutilizar el mismo hash falla.
 */
export function simulateReuseAfterConsume(
  row: PairingCodeRow,
  submittedHash: string,
  now: Date
): ConsumeAttemptResult {
  const consumed: PairingCodeRow = {
    ...row,
    consumedAt: now,
  };
  return attemptConsumePairingCode({
    submittedHash,
    row: consumed,
    now: new Date(now.getTime() + 1000),
  });
}

export function deviceBelongsToPharmacy(input: {
  devicePharmacyId: string;
  requestedPharmacyId: string;
}): boolean {
  return input.devicePharmacyId === input.requestedPharmacyId;
}

export function sessionValidAfterRevoke(input: {
  deviceStatus: 'active' | 'revoked';
  sessionRevokedAt: Date | null;
}): boolean {
  if (input.deviceStatus !== 'active') return false;
  if (input.sessionRevokedAt != null) return false;
  return true;
}
