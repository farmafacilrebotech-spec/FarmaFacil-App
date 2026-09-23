'use server';

import { revalidatePath } from 'next/cache';

import { requirePharmacyCatalogAccess } from '@/lib/auth/access';
import { createClient } from '@/lib/supabase/server';
import {
  DEMO_CATALOG_PRODUCTS,
  DEMO_CATALOG_VERSION,
  demoSourceRef,
} from '@/lib/pharmacies/demo-catalog';

export type DemoSeedPreviewResult =
  | {
      ok: true;
      templateTotal: number;
      alreadyPresent: number;
      willInsert: number;
      version: string;
    }
  | { ok: false; error: string };

export type DemoSeedResult =
  | {
      ok: true;
      inserted: number;
      skipped: number;
      version: string;
    }
  | { ok: false; error: string };

function revalidateCatalog(pharmacyId: string) {
  revalidatePath(`/f/${pharmacyId}/catalogo`);
  revalidatePath(`/farmacias/${pharmacyId}`);
}

/**
 * Vista previa: cuántos productos demo se añadirían sin tocar existentes.
 */
export async function previewDemoCatalogSeedAction(
  pharmacyId: string
): Promise<DemoSeedPreviewResult> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'write');
  if (!access.ok || access.via !== 'platform') {
    return {
      ok: false,
      error: 'Solo SuperAdmin puede cargar el catálogo inicial de demostración.',
    };
  }

  const supabase = createClient();
  const skus = DEMO_CATALOG_PRODUCTS.map((p) => p.sku);
  const refs = DEMO_CATALOG_PRODUCTS.map((p) => demoSourceRef(p.sku));

  const { data, error } = await supabase
    .from('pharmacy_products')
    .select('sku, source_ref')
    .eq('pharmacy_id', pharmacyId)
    .or(
      `sku.in.(${skus.map((s) => `"${s}"`).join(',')}),source_ref.in.(${refs
        .map((r) => `"${r}"`)
        .join(',')})`
    );

  if (error) {
    console.error('[demo-catalog] preview', error.code, error.message);
    if (
      error.message.includes('source_ref') ||
      error.code === '42703' ||
      error.code === 'PGRST204'
    ) {
      return {
        ok: false,
        error:
          'Aplica la migración 022 (source/source_ref) antes de cargar el catálogo inicial.',
      };
    }
    return { ok: false, error: 'No se ha podido preparar la carga del catálogo demo.' };
  }

  const existingSkus = new Set(
    (data ?? []).map((r) => r.sku).filter((s): s is string => !!s)
  );
  const existingRefs = new Set(
    (data ?? []).map((r) => r.source_ref).filter((s): s is string => !!s)
  );

  let alreadyPresent = 0;
  for (const p of DEMO_CATALOG_PRODUCTS) {
    const ref = demoSourceRef(p.sku);
    if (existingSkus.has(p.sku) || existingRefs.has(ref)) {
      alreadyPresent += 1;
    }
  }

  return {
    ok: true,
    templateTotal: DEMO_CATALOG_PRODUCTS.length,
    alreadyPresent,
    willInsert: DEMO_CATALOG_PRODUCTS.length - alreadyPresent,
    version: DEMO_CATALOG_VERSION,
  };
}

/**
 * Copia la plantilla demo a pharmacy_products de la farmacia.
 * No modifica productos ya existentes (por SKU o source_ref).
 */
export async function seedDemoCatalogAction(
  pharmacyId: string
): Promise<DemoSeedResult> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'write');
  if (!access.ok || access.via !== 'platform') {
    return {
      ok: false,
      error: 'Solo SuperAdmin puede cargar el catálogo inicial de demostración.',
    };
  }

  if (!pharmacyId || !/^[0-9a-f-]{36}$/i.test(pharmacyId)) {
    return { ok: false, error: 'Farmacia no válida.' };
  }

  const supabase = createClient();
  const skus = DEMO_CATALOG_PRODUCTS.map((p) => p.sku);
  const refs = DEMO_CATALOG_PRODUCTS.map((p) => demoSourceRef(p.sku));

  const { data: existing, error: existingError } = await supabase
    .from('pharmacy_products')
    .select('sku, source_ref')
    .eq('pharmacy_id', pharmacyId)
    .or(
      `sku.in.(${skus.map((s) => `"${s}"`).join(',')}),source_ref.in.(${refs
        .map((r) => `"${r}"`)
        .join(',')})`
    );

  if (existingError) {
    console.error('[demo-catalog] seed existing', existingError.code, existingError.message);
    if (
      existingError.message.includes('source') ||
      existingError.code === '42703' ||
      existingError.code === 'PGRST204'
    ) {
      return {
        ok: false,
        error:
          'Aplica la migración 022 (source/source_ref) antes de cargar el catálogo inicial.',
      };
    }
    return { ok: false, error: 'No se ha podido cargar el catálogo demo.' };
  }

  const existingSkus = new Set(
    (existing ?? []).map((r) => r.sku).filter((s): s is string => !!s)
  );
  const existingRefs = new Set(
    (existing ?? []).map((r) => r.source_ref).filter((s): s is string => !!s)
  );

  const toInsert = DEMO_CATALOG_PRODUCTS.filter((p) => {
    const ref = demoSourceRef(p.sku);
    return !existingSkus.has(p.sku) && !existingRefs.has(ref);
  }).map((p) => ({
    pharmacy_id: pharmacyId,
    sku: p.sku,
    ean: null,
    name: p.name,
    description: p.description,
    brand: p.brand,
    category: p.category,
    price: p.price,
    stock: p.stock,
    min_stock: p.minStock,
    is_active: true,
    is_featured: false,
    source: 'demo',
    source_ref: demoSourceRef(p.sku),
    created_by: access.profile.id,
    updated_by: access.profile.id,
  }));

  if (toInsert.length === 0) {
    revalidateCatalog(pharmacyId);
    return {
      ok: true,
      inserted: 0,
      skipped: DEMO_CATALOG_PRODUCTS.length,
      version: DEMO_CATALOG_VERSION,
    };
  }

  const { error: insertError } = await supabase
    .from('pharmacy_products')
    .insert(toInsert);

  if (insertError) {
    console.error('[demo-catalog] seed insert', insertError.code, insertError.message);
    if (
      insertError.message.includes('source') ||
      insertError.code === '42703' ||
      insertError.code === 'PGRST204'
    ) {
      return {
        ok: false,
        error:
          'Aplica la migración 022 (source/source_ref) antes de cargar el catálogo inicial.',
      };
    }
    return { ok: false, error: 'No se han podido insertar los productos demo.' };
  }

  revalidateCatalog(pharmacyId);
  return {
    ok: true,
    inserted: toInsert.length,
    skipped: DEMO_CATALOG_PRODUCTS.length - toInsert.length,
    version: DEMO_CATALOG_VERSION,
  };
}
