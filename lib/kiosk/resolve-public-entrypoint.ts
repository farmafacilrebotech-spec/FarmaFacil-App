import { createAdminClient } from '@/lib/supabase/admin';

export type ResolvedPublicEntrypoint =
  | {
      ok: true;
      publicId: string;
      pharmacyId: string;
      pharmacyName: string;
      internalRoute: string;
      purpose: string;
    }
  | { ok: false; reason: 'not_found' | 'inactive' | 'error' };

/**
 * Resolución pública de entrypoint por public_id (service_role, solo servidor).
 * No crea sesión de usuario ni cookies de Auth.
 */
export async function resolvePublicEntrypoint(
  publicId: string
): Promise<ResolvedPublicEntrypoint> {
  const id = publicId?.trim().toLowerCase() ?? '';
  if (!id || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(id)) {
    return { ok: false, reason: 'not_found' };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('public_entrypoints')
      .select(
        `
        public_id,
        pharmacy_id,
        purpose,
        internal_route,
        is_active,
        expires_at,
        pharmacies!inner ( name )
      `
      )
      .eq('public_id', id)
      .maybeSingle();

    if (error) {
      console.error('[entrypoint] resolve', error.message);
      return { ok: false, reason: 'error' };
    }
    if (!data) {
      return { ok: false, reason: 'not_found' };
    }

    const expiresAt = data.expires_at as string | null;
    const expired =
      expiresAt != null && new Date(expiresAt).getTime() <= Date.now();
    if (!data.is_active || expired) {
      return { ok: false, reason: 'inactive' };
    }

    const pharmacies = data.pharmacies as
      | { name: string }
      | { name: string }[]
      | null;
    const pharmacy = Array.isArray(pharmacies)
      ? pharmacies[0]
      : pharmacies;

    return {
      ok: true,
      publicId: String(data.public_id),
      pharmacyId: String(data.pharmacy_id),
      pharmacyName: pharmacy?.name ?? 'Farmacia',
      internalRoute: String(data.internal_route),
      purpose: String(data.purpose),
    };
  } catch (err) {
    console.error('[entrypoint] resolve unexpected', err);
    return { ok: false, reason: 'error' };
  }
}
