import { createClient } from '@/lib/supabase/server';
import { hasPlatformPermission } from '@/lib/auth/platform';
import {
  ALL_PHARMACY_PRODUCTS_KEY,
  loadPharmacyProductCounts,
} from '@/lib/commercial/pharmacy-product-counts';

export type MasterCatalogProduct = {
  id: string;
  categoryId: string;
  categoryName: string;
  subcategoryName: string;
  name: string;
  availabilityStatus: string;
  activeStandardCatalog: boolean;
  availableInPlans: string[];
  updatedAt: string | null;
};

export type PharmacyCatalogSummary = {
  pharmacyId: string;
  pharmacyName: string;
  catalogMode: 'generic' | 'own';
  activeProductCount: number;
  genericProductCount: number;
};

export async function canWriteMasterCatalog(): Promise<boolean> {
  const r = await hasPlatformPermission('platform.pharmacies.write');
  return r.ok;
}

export async function canReadMasterCatalog(): Promise<boolean> {
  const [read, write, trials] = await Promise.all([
    hasPlatformPermission('platform.pharmacies.read'),
    hasPlatformPermission('platform.pharmacies.write'),
    hasPlatformPermission('platform.commercial_trials.manage'),
  ]);
  return read.ok || write.ok || trials.ok;
}

export async function listMasterCatalogProducts(): Promise<
  | {
      ok: true;
      products: MasterCatalogProduct[];
      categories: string[];
      activeCount: number;
    }
  | { ok: false; error: string }
> {
  if (!(await canReadMasterCatalog())) {
    return { ok: false, error: 'Sin permiso para consultar el catálogo maestro.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('ff_master_catalog_products')
    .select(
      'id, category_id, category_name, subcategory_name, generic_product_type, availability_status, active_standard_catalog, available_in_plans, updated_at'
    )
    .order('id', { ascending: true })
    .limit(200);

  if (error) {
    console.error('[master-catalog] list', error.code, error.message);
    return { ok: false, error: 'No se ha podido cargar el catálogo maestro.' };
  }

  const products: MasterCatalogProduct[] = (data ?? []).map((r) => ({
    id: r.id as string,
    categoryId: r.category_id as string,
    categoryName: r.category_name as string,
    subcategoryName: r.subcategory_name as string,
    name: r.generic_product_type as string,
    availabilityStatus: r.availability_status as string,
    activeStandardCatalog: Boolean(r.active_standard_catalog),
    availableInPlans: Array.isArray(r.available_in_plans)
      ? (r.available_in_plans as string[])
      : [],
    updatedAt: (r.updated_at as string | null) ?? null,
  }));

  const categories = Array.from(
    new Set(products.map((p) => p.categoryName).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'es'));

  const activeCount = products.filter((p) => p.activeStandardCatalog).length;

  return { ok: true, products, categories, activeCount };
}

export async function listPharmacyCatalogSummaries(): Promise<
  | { ok: true; rows: PharmacyCatalogSummary[] }
  | { ok: false; error: string }
> {
  const [allowed, write] = await Promise.all([
    hasPlatformPermission('platform.commercial_trials.manage'),
    hasPlatformPermission('platform.pharmacies.write'),
  ]);
  if (!allowed.ok && !write.ok) {
    return { ok: false, error: 'Sin permiso para ver modalidades de farmacia.' };
  }

  const supabase = createClient();
  const { data: pharmacies, error: phErr } = await supabase
    .from('pharmacies')
    .select('id, name')
    .order('name', { ascending: true })
    .limit(300);

  if (phErr) {
    console.error('[master-catalog] pharmacies', phErr.code, phErr.message);
    return { ok: false, error: 'No se han podido cargar farmacias.' };
  }

  const ids = (pharmacies ?? []).map((p) => p.id as string);
  if (ids.length === 0) {
    return { ok: true, rows: [] };
  }

  const [{ data: settings }, counts] = await Promise.all([
    supabase
      .from('pharmacy_settings')
      .select('pharmacy_id, catalog_mode')
      .in('pharmacy_id', ids),
    loadPharmacyProductCounts(ALL_PHARMACY_PRODUCTS_KEY),
  ]);

  const modeMap = new Map<string, 'generic' | 'own'>();
  for (const s of settings ?? []) {
    modeMap.set(
      s.pharmacy_id as string,
      s.catalog_mode === 'own' ? 'own' : 'generic'
    );
  }

  const rows: PharmacyCatalogSummary[] = (pharmacies ?? []).map((p) => {
    const id = p.id as string;
    return {
      pharmacyId: id,
      pharmacyName: (p.name as string) ?? '—',
      catalogMode: modeMap.get(id) ?? 'generic',
      activeProductCount: counts.activeCount.get(id) ?? 0,
      genericProductCount: counts.genericCount.get(id) ?? 0,
    };
  });

  return { ok: true, rows };
}
