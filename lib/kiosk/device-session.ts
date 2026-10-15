import { createClient } from '@/lib/supabase/server';
import { sha256Hex } from '@/lib/kiosk/crypto';
import {
  clearKioskSessionCookie,
  parseKioskSessionCookie,
  readKioskSessionCookie,
} from '@/lib/kiosk/session-cookie';

export type ValidKioskDeviceSession = {
  pharmacyId: string;
  deviceId: string;
  sessionId: string;
  displayName: string;
};

export type KioskSessionFailureReason =
  | 'missing'
  | 'invalid'
  | 'revoked'
  | 'commercially_blocked';

/**
 * Valida la cookie de dispositivo en cada operación protegida del runtime kiosko.
 *
 * - revoked / inválida → limpia cookie
 * - commercially_blocked → mantiene cookie (sesión intacta; acceso se recupera
 *   si la farmacia vuelve a ser operable / con módulo kiosk)
 */
export async function requireValidKioskDeviceSession(): Promise<
  | { ok: true; session: ValidKioskDeviceSession }
  | { ok: false; reason: KioskSessionFailureReason }
> {
  const raw = readKioskSessionCookie();
  const parsed = parseKioskSessionCookie(raw);
  if (!parsed) {
    return { ok: false, reason: 'missing' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_kiosk_validate_device_session_v1',
    {
      p_credential_hash: sha256Hex(parsed.credential),
      p_touch_last_seen: true,
    }
  );

  if (error) {
    console.error('[kiosk] validate session', error.message);
    clearKioskSessionCookie();
    return { ok: false, reason: 'invalid' };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status === 'valid') {
    return {
      ok: true,
      session: {
        pharmacyId: String(payload!.pharmacy_id),
        deviceId: String(payload!.device_id),
        sessionId: String(payload!.session_id),
        displayName: String(payload!.display_name ?? 'Tablet kiosko'),
      },
    };
  }

  if (status === 'commercially_blocked') {
    // No borrar cookie: el derecho comercial puede restablecerse.
    return { ok: false, reason: 'commercially_blocked' };
  }

  clearKioskSessionCookie();
  if (status === 'revoked') {
    return { ok: false, reason: 'revoked' };
  }
  return { ok: false, reason: 'invalid' };
}
