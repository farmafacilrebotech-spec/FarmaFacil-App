import { createClient } from '@/lib/supabase/server';

export type PharmacyCatalogMode = 'generic' | 'own';

/**
 * Lee pharmacy_settings.catalog_mode. Default generic si falta fila o columna.
 */
export async function getPharmacyCatalogMode(
  pharmacyId: string
): Promise<PharmacyCatalogMode> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_settings')
    .select('catalog_mode')
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes('catalog_mode') ||
      error.code === '42703' ||
      error.code === 'PGRST204'
    ) {
      return 'generic';
    }
    console.error('[catalog-mode]', error.code, error.message);
    return 'generic';
  }

  return data?.catalog_mode === 'own' ? 'own' : 'generic';
}

export async function pharmacyHasMasterCatalogProjection(
  pharmacyId: string
): Promise<boolean> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from('pharmacy_products')
    .select('id', { count: 'exact', head: true })
    .eq('pharmacy_id', pharmacyId)
    .eq('is_active', true)
    .eq('source', 'generic')
    .like('source_ref', 'ff_master_v1:%');

  if (error) {
    console.error('[catalog-mode] master count', error.code, error.message);
    return false;
  }
  return (count ?? 0) > 0;
}
