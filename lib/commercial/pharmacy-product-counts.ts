import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

export type PharmacyProductCounts = {
  activeCount: Map<string, number>;
  genericCount: Map<string, number>;
};

function isGenericMasterSource(source: string, sourceRef: string): boolean {
  return (
    (source === 'generic' && sourceRef.startsWith('ff_master_v1:')) ||
    (source === 'demo' && sourceRef.startsWith('farmafacil_demo_v1:'))
  );
}

/** Clave compartida: una sola lectura de pharmacy_products por request RSC. */
export const ALL_PHARMACY_PRODUCTS_KEY = '__all__';

/**
 * Carga conteos de productos activos/genéricos por farmacia.
 * cache() deduplica dentro del mismo request (p.ej. Tarifas: pilotos + resumen).
 * Usar ALL_PHARMACY_PRODUCTS_KEY cuando varios loaders del mismo request
 * necesitan conteos (evita dos round-trips con distintos .in()).
 */
export const loadPharmacyProductCounts = cache(
  async (pharmacyIdsKey: string): Promise<PharmacyProductCounts> => {
    const activeCount = new Map<string, number>();
    const genericCount = new Map<string, number>();

    if (!pharmacyIdsKey) {
      return { activeCount, genericCount };
    }

    const supabase = createClient();
    let query = supabase
      .from('pharmacy_products')
      .select('pharmacy_id, source, source_ref')
      .eq('is_active', true);

    if (pharmacyIdsKey !== ALL_PHARMACY_PRODUCTS_KEY) {
      const pharmacyIds = pharmacyIdsKey
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (pharmacyIds.length === 0) {
        return { activeCount, genericCount };
      }
      query = query.in('pharmacy_id', pharmacyIds);
    }

    const { data: products, error } = await query;

    if (error) {
      console.error('[product-counts]', error.code, error.message);
      return { activeCount, genericCount };
    }

    for (const p of products ?? []) {
      const id = p.pharmacy_id as string;
      activeCount.set(id, (activeCount.get(id) ?? 0) + 1);
      const src = (p.source as string) ?? '';
      const ref = (p.source_ref as string | null) ?? '';
      if (isGenericMasterSource(src, ref)) {
        genericCount.set(id, (genericCount.get(id) ?? 0) + 1);
      }
    }

    return { activeCount, genericCount };
  }
);

export function pharmacyIdsCacheKey(ids: string[]): string {
  return Array.from(new Set(ids)).sort().join(',');
}
