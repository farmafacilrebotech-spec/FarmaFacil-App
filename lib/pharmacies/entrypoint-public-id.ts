/**
 * Reglas de public_id del QR oficial (espejo SQL 042).
 * No usa el nombre de la farmacia; estable tras el alta.
 */

export const ENTRYPOINT_PUBLIC_ID_LENGTH = 16;
export const ENTRYPOINT_PUBLIC_ID_ALPHABET =
  'abcdefghijklmnopqrstuvwxyz0123456789';

const PUBLIC_ID_RE = /^[a-z0-9]{16}$/;

export function isValidEntrypointPublicId(value: string): boolean {
  return PUBLIC_ID_RE.test(value.trim());
}

/**
 * Genera un public_id aleatorio. `randomBytes` inyectable para tests.
 * El SQL 042 comprueba unicidad en BD; aquí solo el formato.
 */
export function generateEntrypointPublicId(
  randomBytes: (size: number) => Uint8Array = defaultRandomBytes
): string {
  const bytes = randomBytes(ENTRYPOINT_PUBLIC_ID_LENGTH);
  let out = '';
  for (let i = 0; i < ENTRYPOINT_PUBLIC_ID_LENGTH; i++) {
    out += ENTRYPOINT_PUBLIC_ID_ALPHABET[bytes[i]! % 36]!;
  }
  return out;
}

function defaultRandomBytes(size: number): Uint8Array {
  const g = globalThis as {
    crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array };
  };
  if (g.crypto?.getRandomValues) {
    const buf = new Uint8Array(size);
    g.crypto.getRandomValues(buf);
    return buf;
  }
  // Fallback Node (tests / server)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require('node:crypto') as {
    randomBytes: (n: number) => Buffer;
  };
  return new Uint8Array(randomBytes(size));
}

/**
 * Idempotencia de ensure: si ya hay pharmacy_home, conservar public_id.
 */
export function resolveEnsureHomeEntrypoint(input: {
  existingPublicId: string | null;
  newlyGeneratedPublicId: string;
}): { publicId: string; created: boolean } {
  const existing = input.existingPublicId?.trim() || null;
  if (existing) {
    return { publicId: existing, created: false };
  }
  return { publicId: input.newlyGeneratedPublicId, created: true };
}

/** Aislamiento: el entrypoint de A no puede usarse como de B. */
export function assertEntrypointBelongsToPharmacy(input: {
  entrypointPharmacyId: string;
  requestedPharmacyId: string;
}): boolean {
  return (
    input.entrypointPharmacyId.trim() === input.requestedPharmacyId.trim()
  );
}
