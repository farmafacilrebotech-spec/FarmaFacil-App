import { createClient } from '@/lib/supabase/server';
import { pharmacyEntrypointPublicUrl } from '@/lib/kiosk/entrypoint-url';

export type PharmacyHomeEntrypoint = {
  id: string;
  pharmacyId: string;
  publicId: string;
  internalRoute: string;
  isActive: boolean;
  qrAssetPath: string | null;
  qrVersion: number;
  /** URL oficial única del QR (misma en kiosko, SuperAdmin e impresos). */
  publicUrl: string;
};

type EntrypointRow = {
  id: string;
  pharmacy_id: string;
  public_id: string;
  internal_route: string;
  is_active: boolean;
  qr_asset_path: string | null;
  qr_version: number;
};

function mapRow(row: EntrypointRow): PharmacyHomeEntrypoint {
  return {
    id: row.id,
    pharmacyId: row.pharmacy_id,
    publicId: row.public_id,
    internalRoute: row.internal_route,
    isActive: row.is_active,
    qrAssetPath: row.qr_asset_path,
    qrVersion: row.qr_version,
    publicUrl: pharmacyEntrypointPublicUrl(row.public_id),
  };
}

/**
 * Lee el entrypoint pharmacy_home de una farmacia (RLS: operable + read).
 */
export async function getPharmacyHomeEntrypoint(
  pharmacyId: string
): Promise<
  | { ok: true; entrypoint: PharmacyHomeEntrypoint | null }
  | { ok: false; error: string }
> {
  if (!pharmacyId || !/^[0-9a-f-]{36}$/i.test(pharmacyId)) {
    return { ok: false, error: 'Farmacia no válida.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('public_entrypoints')
    .select(
      `
      id,
      pharmacy_id,
      public_id,
      internal_route,
      is_active,
      qr_asset_path,
      qr_version
    `
    )
    .eq('pharmacy_id', pharmacyId)
    .eq('purpose', 'pharmacy_home')
    .maybeSingle();

  if (error) {
    console.error('[entrypoint] get home', error.message);
    return {
      ok: false,
      error: 'No se ha podido cargar el código QR de la farmacia.',
    };
  }

  if (!data) {
    return { ok: true, entrypoint: null };
  }

  return { ok: true, entrypoint: mapRow(data as EntrypointRow) };
}

/**
 * Asegura pharmacy_home (idempotente). No regenera public_id si ya existe.
 */
export async function ensurePharmacyHomeEntrypoint(
  pharmacyId: string
): Promise<
  | { ok: true; entrypoint: PharmacyHomeEntrypoint; created: boolean }
  | { ok: false; error: string }
> {
  if (!pharmacyId || !/^[0-9a-f-]{36}$/i.test(pharmacyId)) {
    return { ok: false, error: 'Farmacia no válida.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_ensure_pharmacy_home_entrypoint_v1',
    { p_pharmacy_id: pharmacyId }
  );

  if (error) {
    console.error('[entrypoint] ensure', error.message);
    if (
      error.code === '42883' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        error:
          'El provisionamiento de QR aún no está disponible en la base de datos (migración 042).',
      };
    }
    return {
      ok: false,
      error: 'No se ha podido asegurar el código QR de la farmacia.',
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status === 'forbidden' || status === 'unauthenticated') {
    return {
      ok: false,
      error: 'No tienes permiso para gestionar el QR de esta farmacia.',
    };
  }
  if (status !== 'ok' || !payload?.public_id) {
    return {
      ok: false,
      error: 'No se ha podido asegurar el código QR de la farmacia.',
    };
  }

  const publicId = String(payload.public_id);
  return {
    ok: true,
    created: payload.created === true,
    entrypoint: {
      id: String(payload.entrypoint_id ?? ''),
      pharmacyId: String(payload.pharmacy_id ?? pharmacyId),
      publicId,
      internalRoute: String(payload.internal_route ?? `/e/${publicId}`),
      isActive: payload.is_active !== false,
      qrAssetPath:
        typeof payload.qr_asset_path === 'string'
          ? payload.qr_asset_path
          : null,
      qrVersion: Number(payload.qr_version ?? 1),
      publicUrl: pharmacyEntrypointPublicUrl(publicId),
    },
  };
}

/**
 * Carga el QR oficial; si falta, intenta ensure (SuperAdmin / manage).
 */
export async function loadOrEnsurePharmacyHomeEntrypoint(
  pharmacyId: string
): Promise<
  | { ok: true; entrypoint: PharmacyHomeEntrypoint; created: boolean }
  | { ok: false; error: string }
> {
  const existing = await getPharmacyHomeEntrypoint(pharmacyId);
  if (!existing.ok) {
    return existing;
  }
  if (existing.entrypoint) {
    return {
      ok: true,
      entrypoint: existing.entrypoint,
      created: false,
    };
  }
  return ensurePharmacyHomeEntrypoint(pharmacyId);
}
