import { createClient } from '@/lib/supabase/server';
import { sha256Hex } from '@/lib/kiosk/crypto';
import {
  clearKioskSessionCookie,
  parseKioskSessionCookie,
  readKioskSessionCookie,
} from '@/lib/kiosk/session-cookie';
import { pharmacyEntrypointPublicUrl } from '@/lib/kiosk/entrypoint-url';
import type { ValidKioskDeviceSession } from '@/lib/kiosk/device-session';

export type KioskPharmacyEntrypoint = {
  publicId: string;
  purpose: string;
  internalRoute: string;
  qrAssetPath: string | null;
  qrVersion: number;
  /** URL que se codifica en el QR (no autentica por sí sola). */
  publicUrl: string;
};

export type KioskHomeContext = {
  pharmacyId: string;
  pharmacyName: string;
  welcomeMessage: string | null;
  deviceDisplayName: string;
  entrypoint: KioskPharmacyEntrypoint | null;
  /** true si la RPC 041 aún no está en la BD o falló de forma recuperable. */
  entrypointLookupUnavailable: boolean;
};

/**
 * Contexto de bienvenida del kiosko para la farmacia de la sesión de dispositivo.
 * No acepta pharmacyId del cliente: solo cookie + RPC DEFINER.
 */
export async function loadKioskHomeContext(
  session: ValidKioskDeviceSession
): Promise<KioskHomeContext> {
  const fallback: KioskHomeContext = {
    pharmacyId: session.pharmacyId,
    pharmacyName: 'Tu farmacia',
    welcomeMessage: null,
    deviceDisplayName: session.displayName,
    entrypoint: null,
    entrypointLookupUnavailable: true,
  };

  const raw = readKioskSessionCookie();
  const parsed = parseKioskSessionCookie(raw);
  if (!parsed) {
    return fallback;
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_get_home_context_v1', {
    p_credential_hash: sha256Hex(parsed.credential),
  });

  if (error) {
    console.error('[kiosk] home context', error.message);
    return fallback;
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status === 'session_revoked' || status === 'session_invalid') {
    clearKioskSessionCookie();
    return fallback;
  }
  if (status === 'commercially_blocked' || status !== 'ok') {
    return fallback;
  }

  // Defensa: la farmacia del RPC debe coincidir con la ya validada.
  const pharmacyId = String(payload!.pharmacy_id ?? '');
  if (pharmacyId !== session.pharmacyId) {
    console.error('[kiosk] home context pharmacy mismatch');
    return fallback;
  }

  const epRaw = payload!.entrypoint;
  let entrypoint: KioskPharmacyEntrypoint | null = null;
  if (epRaw && typeof epRaw === 'object') {
    const ep = epRaw as Record<string, unknown>;
    const publicId =
      typeof ep.public_id === 'string' ? ep.public_id.trim() : '';
    if (publicId) {
      entrypoint = {
        publicId,
        purpose: String(ep.purpose ?? 'pharmacy_home'),
        internalRoute: String(ep.internal_route ?? ''),
        qrAssetPath:
          typeof ep.qr_asset_path === 'string' && ep.qr_asset_path.trim()
            ? ep.qr_asset_path.trim()
            : null,
        qrVersion: Number(ep.qr_version ?? 1),
        publicUrl: pharmacyEntrypointPublicUrl(publicId),
      };
    }
  }

  return {
    pharmacyId,
    pharmacyName: String(payload!.pharmacy_name ?? 'Tu farmacia'),
    welcomeMessage:
      typeof payload!.welcome_message === 'string'
        ? payload!.welcome_message
        : null,
    deviceDisplayName: String(
      payload!.device_display_name ?? session.displayName
    ),
    entrypoint,
    entrypointLookupUnavailable: false,
  };
}
