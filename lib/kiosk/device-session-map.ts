/**
 * Mapeo puro del resultado de ff_kiosk_validate_device_session_v1.
 * Sin next/headers ni mutación de cookies (seguro en tests y en RSC).
 */

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

export type KioskDeviceSessionResult =
  | { ok: true; session: ValidKioskDeviceSession }
  | { ok: false; reason: KioskSessionFailureReason };

/**
 * Interpreta el JSON de validación de sesión de dispositivo.
 *
 * - `missing`: no hay cookie parseable (lo decide el caller antes).
 * - `rpcError`: fallo de red/RPC → invalid (no asumir revoked).
 * - status `revoked` cubre también sesión caducada / credencial desconocida (RPC 036).
 */
export function mapValidateDeviceSessionRpc(input: {
  /** Cookie ausente o no parseable. */
  cookieMissing?: boolean;
  rpcError?: boolean;
  data?: unknown;
}): KioskDeviceSessionResult {
  if (input.cookieMissing) {
    return { ok: false, reason: 'missing' };
  }

  if (input.rpcError) {
    return { ok: false, reason: 'invalid' };
  }

  const payload =
    input.data && typeof input.data === 'object'
      ? (input.data as Record<string, unknown>)
      : null;
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status === 'valid') {
    return {
      ok: true,
      session: {
        pharmacyId: String(payload!.pharmacy_id ?? ''),
        deviceId: String(payload!.device_id ?? ''),
        sessionId: String(payload!.session_id ?? ''),
        displayName: String(payload!.display_name ?? 'Tablet kiosko'),
      },
    };
  }

  if (status === 'commercially_blocked') {
    return { ok: false, reason: 'commercially_blocked' };
  }

  if (status === 'revoked') {
    return { ok: false, reason: 'revoked' };
  }

  return { ok: false, reason: 'invalid' };
}

/** Destino de redirección para páginas /k/* protegidas (sin mutar cookies). */
export function kioskSessionFailureRedirectPath(
  reason: KioskSessionFailureReason
): '/k' | '/k/pair' {
  if (reason === 'commercially_blocked' || reason === 'revoked') {
    return '/k';
  }
  return '/k/pair';
}
