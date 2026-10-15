import { createHash, randomBytes } from 'node:crypto';

/** Normaliza código de emparejamiento (sin espacios/guiones, mayúsculas). */
export function normalizePairingCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

/** SHA-256 hex del valor normalizado (códigos y secretos de sesión). */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function hashPairingCode(rawCode: string): string {
  return sha256Hex(normalizePairingCode(rawCode));
}

/** Secreto de sesión (~256 bits) en base64url. */
export function generateSessionCredential(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Código legible de 8 caracteres (sin 0/O/1/I).
 * Formato de presentación: XXXX-XXXX.
 */
const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePairingCodePlaintext(): string {
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += PAIRING_ALPHABET[bytes[i]! % PAIRING_ALPHABET.length];
  }
  return out;
}

export function formatPairingCodeDisplay(code: string): string {
  const n = normalizePairingCode(code);
  if (n.length !== 8) return n;
  return `${n.slice(0, 4)}-${n.slice(4)}`;
}

export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
export const DEVICE_SESSION_TTL_DAYS = 90;
