import { createClient } from '@/lib/supabase/server';
import { getCustomerProfile } from '@/lib/customer/queries';
import { normalizePublicEntrypointId } from '@/lib/kiosk/public-id';

export type SavedPharmacy = {
  id: string;
  pharmacyId: string;
  publicId: string;
  pharmacyName: string;
  savedAt: string;
};

export async function listSavedPharmacies(): Promise<
  | { ok: true; items: SavedPharmacy[] }
  | { ok: false; error: string; code?: string }
> {
  const profile = await getCustomerProfile();
  if (!profile.ok) {
    return { ok: false, error: profile.error, code: profile.code };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_customer_list_saved_pharmacies_v1'
  );

  if (error) {
    console.error('[customer] list saved pharmacies', error.message);
    if (
      error.code === '42883' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        error:
          'Falta aplicar la migración 067 (Mis farmacias). Contacta con FarmaFácil.',
        code: 'migration_missing',
      };
    }
    return { ok: false, error: 'No se han podido cargar tus farmacias.' };
  }

  const body = data as { status?: string; items?: unknown[] };
  if (body?.status !== 'ok') {
    return { ok: false, error: 'No se han podido cargar tus farmacias.' };
  }

  const items = (body.items ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id),
      pharmacyId: String(r.pharmacy_id),
      publicId: String(r.public_id),
      pharmacyName: String(r.pharmacy_name ?? 'Farmacia'),
      savedAt: String(r.saved_at),
    };
  });

  return { ok: true, items };
}

export async function isPharmacySaved(
  publicId: string
): Promise<boolean> {
  const id = normalizePublicEntrypointId(publicId);
  if (!id) return false;
  const profile = await getCustomerProfile();
  if (!profile.ok) return false;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('customer_saved_pharmacies')
    .select('id')
    .eq('profile_id', profile.profile.id)
    .eq('public_id', id)
    .maybeSingle();

  if (error) {
    // Tabla aún no migrada → tratar como no guardada.
    return false;
  }
  return Boolean(data?.id);
}
