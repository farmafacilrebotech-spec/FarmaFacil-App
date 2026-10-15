import { createHash } from 'node:crypto';
import { headers } from 'next/headers';

/**
 * Huella estable del cliente para rate-limit de pairing (hash SHA-256).
 * Solo usa IP (y UA como sal débil); no confía en cookies del navegador.
 */
export function kioskPairingClientBucketKey(): string {
  const h = headers();
  const forwarded = h.get('x-forwarded-for');
  const ip =
    (forwarded ? forwarded.split(',')[0]?.trim() : null) ||
    h.get('x-real-ip')?.trim() ||
    h.get('cf-connecting-ip')?.trim() ||
    'unknown';
  const ua = h.get('user-agent')?.slice(0, 120) ?? '';
  return createHash('sha256')
    .update(`kiosk-pair-v1:${ip}:${ua}`, 'utf8')
    .digest('hex');
}
