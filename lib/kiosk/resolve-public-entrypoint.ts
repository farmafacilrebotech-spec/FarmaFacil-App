import { createClient } from '@/lib/supabase/server';
import {
  mapResolveEntrypointRpcPayload,
  normalizePublicEntrypointId,
} from '@/lib/kiosk/public-id';

export type ResolvedPublicEntrypoint =
  | {
      ok: true;
      publicId: string;
      pharmacyName: string;
    }
  | { ok: false; reason: 'not_found' | 'inactive' | 'error' };

/**
 * Resolución pública de entrypoint por public_id (purpose pharmacy_home).
 * Usa RPC DEFINER (044) con el cliente normal — no requiere service_role.
 * No crea sesión de usuario ni cookies de Auth.
 */
export async function resolvePublicEntrypoint(
  publicId: string
): Promise<ResolvedPublicEntrypoint> {
  const id = normalizePublicEntrypointId(publicId);
  if (!id) {
    return { ok: false, reason: 'not_found' };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc(
      'ff_resolve_public_entrypoint_v1',
      { p_public_id: id }
    );

    if (error) {
      console.error('[entrypoint] resolve', error.message);
      if (
        error.code === '42883' ||
        error.message.toLowerCase().includes('does not exist')
      ) {
        return { ok: false, reason: 'error' };
      }
      return { ok: false, reason: 'error' };
    }

    return mapResolveEntrypointRpcPayload(data);
  } catch (err) {
    console.error('[entrypoint] resolve unexpected', err);
    return { ok: false, reason: 'error' };
  }
}
