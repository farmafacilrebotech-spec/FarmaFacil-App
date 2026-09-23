import { createClient } from '@/lib/supabase/server';
import { requirePharmacyCatalogAccess } from '@/lib/auth/access';
import {
  mapPharmacyProduct,
  type PharmacyProduct,
  type PharmacyProductInput,
  type PharmacyProductRow,
  type ProductListFilters,
} from '@/lib/pharmacies/products-types';

export type ProductsResult =
  | { ok: true; products: PharmacyProduct[]; categories: string[] }
  | { ok: false; error: string };

/**
 * Lista productos de la farmacia tras comprobar membership active.
 * No confía en pharmacyId del cliente más allá de filtrar memberships autorizadas.
 */
export async function listPharmacyProducts(
  pharmacyId: string,
  filters: ProductListFilters = {}
): Promise<ProductsResult> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'read');
  if (!access.ok) {
    return { ok: false, error: 'No autorizado.' };
  }

  const supabase = createClient();
  let query = supabase
    .from('pharmacy_products')
    .select(
      'id, pharmacy_id, sku, ean, name, description, brand, category, price, stock, min_stock, is_active, is_featured, source, source_ref, created_at, updated_at'
    )
    .eq('pharmacy_id', pharmacyId)
    .order('name', { ascending: true });

  const status = filters.status ?? 'all';
  if (status === 'active') query = query.eq('is_active', true);
  if (status === 'inactive') query = query.eq('is_active', false);

  if (filters.category && filters.category !== 'all') {
    query = query.eq('category', filters.category);
  }

  const q = filters.q?.trim();
  if (q) {
    const escaped = q.replace(/[%_,]/g, '');
    query = query.or(
      `name.ilike.%${escaped}%,sku.ilike.%${escaped}%,ean.ilike.%${escaped}%,brand.ilike.%${escaped}%`
    );
  }

  let { data, error } = await query;

  // Compatibilidad: si 022 aún no está aplicada, reintenta sin source/source_ref.
  if (
    error &&
    (error.message.includes('source') || error.code === '42703' || error.code === 'PGRST204')
  ) {
    let fallback = supabase
      .from('pharmacy_products')
      .select(
        'id, pharmacy_id, sku, ean, name, description, brand, category, price, stock, min_stock, is_active, is_featured, created_at, updated_at'
      )
      .eq('pharmacy_id', pharmacyId)
      .order('name', { ascending: true });
    if (status === 'active') fallback = fallback.eq('is_active', true);
    if (status === 'inactive') fallback = fallback.eq('is_active', false);
    if (filters.category && filters.category !== 'all') {
      fallback = fallback.eq('category', filters.category);
    }
    if (q) {
      const escaped = q.replace(/[%_,]/g, '');
      fallback = fallback.or(
        `name.ilike.%${escaped}%,sku.ilike.%${escaped}%,ean.ilike.%${escaped}%,brand.ilike.%${escaped}%`
      );
    }
    const retried = await fallback;
    data = retried.data as typeof data;
    error = retried.error;
  }

  if (error) {
    console.error('[products] list', error.code, error.message);
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      return {
        ok: false,
        error:
          'El catálogo aún no está disponible en la base de datos. Aplica la migración 020.',
      };
    }
    return { ok: false, error: 'No se ha podido cargar el catálogo.' };
  }

  const products = (data as PharmacyProductRow[] | null ?? []).map(
    mapPharmacyProduct
  );
  const categories = Array.from(
    new Set(
      products
        .map((p) => p.category)
        .filter((c): c is string => !!c && c.trim().length > 0)
    )
  ).sort((a, b) => a.localeCompare(b, 'es'));

  return { ok: true, products, categories };
}

export async function getPharmacyProduct(
  pharmacyId: string,
  productId: string
): Promise<{ ok: true; product: PharmacyProduct } | { ok: false; error: string }> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'read');
  if (!access.ok) {
    return { ok: false, error: 'No autorizado.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_products')
    .select(
      'id, pharmacy_id, sku, ean, name, description, brand, category, price, stock, min_stock, is_active, is_featured, source, source_ref, created_at, updated_at'
    )
    .eq('pharmacy_id', pharmacyId)
    .eq('id', productId)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: 'Producto no encontrado.' };
  }

  return { ok: true, product: mapPharmacyProduct(data as PharmacyProductRow) };
}

export function toProductInsert(
  pharmacyId: string,
  profileId: string,
  input: PharmacyProductInput,
  meta?: { source?: 'manual' | 'import' | 'demo'; sourceRef?: string | null }
) {
  const payload: Record<string, unknown> = {
    pharmacy_id: pharmacyId,
    sku: input.sku,
    ean: input.ean,
    name: input.name.trim(),
    description: input.description,
    brand: input.brand,
    category: input.category,
    price: input.price,
    stock: input.stock,
    min_stock: input.minStock,
    is_active: input.isActive ?? true,
    is_featured: input.isFeatured ?? false,
    created_by: profileId,
    updated_by: profileId,
  };
  // Solo incluir source si se pide explícitamente (requiere migración 022).
  if (meta?.source) {
    payload.source = meta.source;
    payload.source_ref = meta.sourceRef ?? null;
  }
  return payload;
}

export function toProductUpdate(
  profileId: string,
  input: PharmacyProductInput
) {
  return {
    sku: input.sku,
    ean: input.ean,
    name: input.name.trim(),
    description: input.description,
    brand: input.brand,
    category: input.category,
    price: input.price,
    stock: input.stock,
    min_stock: input.minStock,
    is_active: input.isActive ?? true,
    is_featured: input.isFeatured ?? false,
    updated_by: profileId,
  };
}
