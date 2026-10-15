'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

import { createClient } from '@/lib/supabase/server';
import {
  requireKioskCommercialAccess,
  requireKioskDevicesManage,
} from '@/lib/kiosk/authz';
import { kioskPairingClientBucketKey } from '@/lib/kiosk/client-bucket';
import {
  DEVICE_SESSION_TTL_DAYS,
  formatPairingCodeDisplay,
  generatePairingCodePlaintext,
  generateSessionCredential,
  hashPairingCode,
  PAIRING_CODE_TTL_MS,
  sha256Hex,
} from '@/lib/kiosk/crypto';
import { PAIRING_GENERIC_FAILURE_MESSAGE } from '@/lib/kiosk/pairing-rate-limit';
import { setKioskSessionCookie } from '@/lib/kiosk/session-cookie';

export type CreatePairingCodeResult =
  | {
      ok: true;
      code: string;
      displayCode: string;
      expiresAt: string;
    }
  | { ok: false; error: string };

export type RevokeDeviceResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export type PairDeviceResult =
  | {
      ok: true;
      pharmacyId: string;
      deviceId: string;
    }
  | { ok: false; error: string };

function revalidateDevices(pharmacyId: string) {
  revalidatePath(`/f/${pharmacyId}/dispositivos`);
  revalidatePath(`/farmacias/${pharmacyId}`);
}

/**
 * Genera código one-shot (10 min). Solo OWNER/ADMIN o SuperAdmin.
 * Exige farmacia operable + módulo kiosk. Plaintext una vez; BD solo hash.
 */
export async function createKioskPairingCodeAction(
  pharmacyId: string
): Promise<CreatePairingCodeResult> {
  const auth = await requireKioskDevicesManage(pharmacyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const commercial = await requireKioskCommercialAccess(pharmacyId);
  if (!commercial.ok) {
    return { ok: false, error: commercial.error };
  }

  const plaintext = generatePairingCodePlaintext();
  const codeHash = hashPairingCode(plaintext);
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString();

  const supabase = createClient();
  const { error } = await supabase.from('pharmacy_device_pairing_codes').insert({
    pharmacy_id: pharmacyId,
    code_hash: codeHash,
    expires_at: expiresAt,
    created_by: auth.actorId,
  });

  if (error) {
    console.error('[kiosk] create pairing code', error.message);
    if (error.code === '23505') {
      return {
        ok: false,
        error: 'No se ha podido generar el código. Inténtalo de nuevo.',
      };
    }
    return {
      ok: false,
      error: 'No se ha podido crear el código de vinculación.',
    };
  }

  revalidateDevices(pharmacyId);
  return {
    ok: true,
    code: plaintext,
    displayCode: formatPairingCodeDisplay(plaintext),
    expiresAt,
  };
}

export async function revokeKioskDeviceAction(input: {
  pharmacyId: string;
  deviceId: string;
}): Promise<RevokeDeviceResult> {
  const pharmacyId = input.pharmacyId?.trim() ?? '';
  const deviceId = input.deviceId?.trim() ?? '';
  const auth = await requireKioskDevicesManage(pharmacyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }
  if (!deviceId || !/^[0-9a-f-]{36}$/i.test(deviceId)) {
    return { ok: false, error: 'Dispositivo no válido.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_revoke_device_v1', {
    p_device_id: deviceId,
    p_pharmacy_id: pharmacyId,
  });

  if (error) {
    console.error('[kiosk] revoke', error.message);
    return { ok: false, error: 'No se ha podido revocar el dispositivo.' };
  }

  const status =
    data && typeof data === 'object' && 'status' in data
      ? String((data as { status: unknown }).status)
      : '';

  if (status === 'ok') {
    revalidateDevices(pharmacyId);
    return {
      ok: true,
      message:
        'Dispositivo revocado. La tablet perderá el acceso en la siguiente operación.',
    };
  }
  if (status === 'forbidden') {
    return { ok: false, error: 'No tienes permiso para revocar este dispositivo.' };
  }
  if (status === 'not_found') {
    return {
      ok: false,
      error: 'El dispositivo no existe, no es de esta farmacia o ya estaba revocado.',
    };
  }
  return { ok: false, error: 'No se ha podido revocar el dispositivo.' };
}

/**
 * Empareja tablet con código. Público (sin sesión humana).
 * Rate-limit durable en BD; mensaje de fallo homogéneo (anti-enumeración).
 * Cookie HttpOnly Path=/k.
 */
export async function pairKioskDeviceAction(input: {
  code: string;
  displayName?: string;
}): Promise<PairDeviceResult> {
  const code = input.code?.trim() ?? '';
  if (!code) {
    return { ok: false, error: 'Introduce el código de vinculación.' };
  }

  const codeHash = hashPairingCode(code);
  const credential = generateSessionCredential();
  const credentialHash = sha256Hex(credential);
  const displayName =
    input.displayName?.trim() ||
    `Tablet ${new Date().toISOString().slice(0, 10)}`;

  const ua = headers().get('user-agent')?.slice(0, 512) ?? null;
  const bucketKey = kioskPairingClientBucketKey();

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_kiosk_consume_pairing_code_v1',
    {
      p_code_hash: codeHash,
      p_credential_hash: credentialHash,
      p_display_name: displayName,
      p_user_agent: ua,
      p_session_ttl_days: DEVICE_SESSION_TTL_DAYS,
      p_client_bucket_key: bucketKey,
    }
  );

  if (error) {
    console.error('[kiosk] consume pairing', error.message);
    if (
      error.code === '42883' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        error:
          'El emparejamiento de kiosko aún no está disponible en la base de datos.',
      };
    }
    return {
      ok: false,
      error: 'No se ha podido vincular el dispositivo. Inténtalo de nuevo.',
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status !== 'ok') {
    return {
      ok: false,
      error: PAIRING_GENERIC_FAILURE_MESSAGE,
    };
  }

  const sessionId = String(payload!.session_id);
  const pharmacyId = String(payload!.pharmacy_id);
  const deviceId = String(payload!.device_id);

  setKioskSessionCookie(sessionId, credential);
  revalidateDevices(pharmacyId);

  return { ok: true, pharmacyId, deviceId };
}
