import { createClient } from '@/lib/supabase/server';
import { sha256Hex } from '@/lib/kiosk/crypto';
import {
  parseKioskSessionCookie,
  readKioskSessionCookie,
} from '@/lib/kiosk/session-cookie';
import {
  mapValidateDeviceSessionRpc,
  type KioskDeviceSessionResult,
  type KioskSessionFailureReason,
  type ValidKioskDeviceSession,
} from '@/lib/kiosk/device-session-map';

export type {
  KioskDeviceSessionResult,
  KioskSessionFailureReason,
  ValidKioskDeviceSession,
} from '@/lib/kiosk/device-session-map';

export { kioskSessionFailureRedirectPath } from '@/lib/kiosk/device-session-map';

/**
 * Valida la cookie de dispositivo en cada operación protegida del runtime kiosko.
 *
 * Importante (Next.js RSC): **no** elimina ni modifica cookies aquí.
 * Mutar cookies en Server Components provoca el error digest (p. ej. 4150501925).
 * La cookie se sustituye al emparejar (`setKioskSessionCookie` en Server Action)
 * o se limpia solo desde Server Actions / Route Handlers (`clearKioskSessionCookie`).
 *
 * - revoked / inválida → reason; UI controlada en `/k` o redirect a `/k/pair`
 * - commercially_blocked → mantiene cookie (el derecho comercial puede volver)
 */
export async function requireValidKioskDeviceSession(): Promise<KioskDeviceSessionResult> {
  const raw = readKioskSessionCookie();
  const parsed = parseKioskSessionCookie(raw);
  if (!parsed) {
    return mapValidateDeviceSessionRpc({ cookieMissing: true });
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
    return mapValidateDeviceSessionRpc({ rpcError: true });
  }

  return mapValidateDeviceSessionRpc({ data });
}
