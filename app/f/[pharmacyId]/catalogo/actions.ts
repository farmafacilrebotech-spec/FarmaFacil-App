'use server';

import {
  pharmacyProductInputSchema,
  type PharmacyProductInput,
} from '@/lib/pharmacies/products-types';
import {
  listPharmacyProducts,
  toProductInsert,
  toProductUpdate,
} from '@/lib/pharmacies/products';
import {
  buildProductImportPreview,
  shouldPersistImportRow,
  suggestProductColumnMapping,
  type ProductImportDraft,
} from '@/lib/pharmacies/product-import';
import {
  isBlankCell,
  normalizeIdentifier,
} from '@/lib/pharmacies/product-import-validate';
import { parseSpreadsheetFile } from '@/lib/import/parse-file';
import type { ColumnMapping } from '@/lib/import/spreadsheet';
import { createClient } from '@/lib/supabase/server';
import { requirePharmacyCatalogAccess } from '@/lib/auth/access';
import { revalidatePath } from 'next/cache';

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type CreateProductResult =
  | { ok: true; productId: string }
  | { ok: false; error: string };

function mapDbError(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (code === '23505' || m.includes('duplicate') || m.includes('unique')) {
    if (m.includes('ean')) return 'Ya existe un producto con ese EAN en esta farmacia.';
    if (m.includes('sku')) return 'Ya existe un producto con ese SKU en esta farmacia.';
    return 'Ya existe un producto con ese código en esta farmacia.';
  }
  if (code === '42P01' || m.includes('does not exist')) {
    return 'El catálogo aún no está disponible. Aplica la migración 020.';
  }
  if (code === '42501' || m.includes('permission')) {
    return 'No tienes permiso para modificar el catálogo.';
  }
  return 'No se ha podido guardar el producto. Inténtalo de nuevo.';
}

export async function createPharmacyProductAction(
  pharmacyId: string,
  raw: PharmacyProductInput
): Promise<CreateProductResult> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'write');
  if (!access.ok) return { ok: false, error: 'No autorizado.' };

  // Altas manuales = catálogo propio (mismo gate que import).
  if (access.via !== 'platform') {
    const modeGate = await requireOwnCatalogMode(pharmacyId);
    if (!modeGate.ok) return modeGate;
  }

  const parsed = pharmacyProductInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Datos no válidos.',
    };
  }

  const supabase = createClient();
  const payload = toProductInsert(
    pharmacyId,
    access.profile.id,
    parsed.data,
    { source: 'manual' }
  );

  const { data, error } = await supabase
    .from('pharmacy_products')
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    console.error('[catalog] create', error.code, error.message);
    return { ok: false, error: mapDbError(error.message, error.code) };
  }

  revalidatePath(`/f/${pharmacyId}/catalogo`);
  revalidatePath(`/farmacias/${pharmacyId}`);
  return { ok: true, productId: data.id as string };
}

export async function updatePharmacyProductAction(
  pharmacyId: string,
  productId: string,
  raw: PharmacyProductInput
): Promise<ActionResult> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'write');
  if (!access.ok) return { ok: false, error: 'No autorizado.' };

  const parsed = pharmacyProductInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Datos no válidos.',
    };
  }

  const supabase = createClient();
  // No permitir editar proyecciones del maestro desde la farmacia (también enforced en SQL).
  let updateQuery = supabase
    .from('pharmacy_products')
    .update(toProductUpdate(access.profile.id, parsed.data))
    .eq('id', productId)
    .eq('pharmacy_id', pharmacyId);
  if (access.via !== 'platform') {
    updateQuery = updateQuery.in('source', ['manual', 'import']);
  }
  const { error } = await updateQuery;

  if (error) {
    console.error('[catalog] update', error.code, error.message);
    return { ok: false, error: mapDbError(error.message, error.code) };
  }

  revalidatePath(`/f/${pharmacyId}/catalogo`);
  revalidatePath(`/farmacias/${pharmacyId}`);
  return { ok: true };
}

export async function setPharmacyProductActiveAction(
  pharmacyId: string,
  productId: string,
  isActive: boolean
): Promise<ActionResult> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'write');
  if (!access.ok) return { ok: false, error: 'No autorizado.' };

  const supabase = createClient();
  const { error } = await supabase
    .from('pharmacy_products')
    .update({
      is_active: isActive,
      updated_by: access.profile.id,
    })
    .eq('id', productId)
    .eq('pharmacy_id', pharmacyId);

  if (error) {
    console.error('[catalog] setActive', error.code, error.message);
    return { ok: false, error: mapDbError(error.message, error.code) };
  }

  revalidatePath(`/f/${pharmacyId}/catalogo`);
  revalidatePath(`/farmacias/${pharmacyId}`);
  return { ok: true };
}

export type PreviewImportResult =
  | {
      ok: true;
      headers: string[];
      suggestedMapping: ColumnMapping;
      preview: ReturnType<typeof buildProductImportPreview>;
    }
  | { ok: false; error: string };

/**
 * Paso 1–3: parsea archivo, sugiere mapeo y genera preview.
 * No escribe en BD. El fichero no se almacena.
 */
async function requireOwnCatalogMode(
  pharmacyId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_settings')
    .select('catalog_mode')
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    // Columna aún no migrada (054): no bloquear en entornos sin 054.
    if (
      error.message.includes('catalog_mode') ||
      error.code === '42703' ||
      error.code === 'PGRST204'
    ) {
      return {
        ok: false,
        error:
          'La modalidad de catálogo aún no está disponible. Aplica la migración 054.',
      };
    }
    console.error('[catalog] mode', error.code, error.message);
    return { ok: false, error: 'No se ha podido verificar la modalidad de catálogo.' };
  }
  const mode = data?.catalog_mode === 'own' ? 'own' : 'generic';
  if (mode !== 'own') {
    return {
      ok: false,
      error:
        'La importación de catálogo propio solo está disponible en modalidad Personalizado.',
    };
  }
  return { ok: true };
}

export async function previewProductImportAction(
  pharmacyId: string,
  formData: FormData
): Promise<PreviewImportResult> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'write');
  if (!access.ok) return { ok: false, error: 'No autorizado.' };

  const modeGate = await requireOwnCatalogMode(pharmacyId);
  if (!modeGate.ok) return modeGate;

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { ok: false, error: 'Selecciona un archivo .xlsx o .csv.' };
  }

  const parsed = await parseSpreadsheetFile(file);
  if (!parsed.ok) return parsed;

  const list = await listPharmacyProducts(pharmacyId, { status: 'all' });
  if (!list.ok) return { ok: false, error: list.error };

  const suggestedMapping = suggestProductColumnMapping(parsed.data.headers);
  const mappingRaw = formData.get('mapping');
  let mapping = suggestedMapping;
  if (typeof mappingRaw === 'string' && mappingRaw.trim()) {
    try {
      mapping = JSON.parse(mappingRaw) as ColumnMapping;
    } catch {
      return { ok: false, error: 'Mapeo de columnas no válido.' };
    }
  }

  if (mapping.name == null) {
    return {
      ok: false,
      error: 'Debes indicar qué columna corresponde al nombre del producto.',
    };
  }

  const preview = buildProductImportPreview(
    parsed.data,
    mapping,
    list.products
  );

  return {
    ok: true,
    headers: parsed.data.headers,
    suggestedMapping,
    preview,
  };
}

export type ConfirmImportResult =
  | {
      ok: true;
      created: number;
      updated: number;
      skipped: number;
      elapsedMs: number;
      mode: 'batch_insert' | 'rpc_batch';
    }
  | { ok: false; error: string };

const IMPORT_INSERT_CHUNK = 100;

function buildImportInsertRow(
  pharmacyId: string,
  profileId: string,
  draft: ProductImportDraft
) {
  const sku =
    normalizeIdentifier(draft.sku) ?? normalizeIdentifier(draft.nationalCode);
  const ean = normalizeIdentifier(draft.ean);
  const brand = isBlankCell(draft.brand) ? null : draft.brand;
  const category = isBlankCell(draft.category)
    ? isBlankCell(draft.sourceFamily)
      ? null
      : draft.sourceFamily
    : draft.category;
  return {
    pharmacy_id: pharmacyId,
    sku,
    ean,
    name: draft.name.trim(),
    description: isBlankCell(draft.description) ? null : draft.description,
    brand,
    category,
    price: draft.priceProvided && draft.price != null ? draft.price : 0,
    stock: draft.stockProvided && draft.stock != null ? draft.stock : 0,
    min_stock:
      draft.minStockProvided && draft.minStock != null ? draft.minStock : 0,
    is_active: true,
    is_featured: false,
    source: 'import' as const,
    availability_status: 'available',
    created_by: profileId,
    updated_by: profileId,
  };
}

/**
 * Persiste altas/actualizaciones ya validadas.
 * Altas en lotes de 100 (PostgREST multi-insert). Sin 1 request/producto.
 * Si existe RPC 107, se intenta primero; si no, fallback batch insert.
 */
export async function confirmProductImportAction(
  pharmacyId: string,
  payload: {
    rows: Array<{
      action:
        | 'create'
        | 'update'
        | 'unchanged'
        | 'skip'
        | 'pending_classification';
      matchedProductId: string | null;
      draft: ProductImportDraft;
    }>;
  }
): Promise<ConfirmImportResult> {
  const started = Date.now();
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'write');
  if (!access.ok) return { ok: false, error: 'No autorizado.' };

  const modeGate = await requireOwnCatalogMode(pharmacyId);
  if (!modeGate.ok) return modeGate;

  const rows = payload.rows ?? [];
  if (rows.length === 0) {
    return { ok: false, error: 'No hay filas para importar.' };
  }
  if (rows.length > 20000) {
    return { ok: false, error: 'Demasiadas filas en la importación.' };
  }

  const supabase = createClient();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const toCreate: ProductImportDraft[] = [];
  const toUpdate: Array<{ id: string; draft: ProductImportDraft }> = [];

  for (const row of rows) {
    if (!shouldPersistImportRow(row)) {
      skipped += 1;
      continue;
    }
    if (row.action === 'update' && row.matchedProductId) {
      toUpdate.push({ id: row.matchedProductId, draft: row.draft });
    } else {
      toCreate.push(row.draft);
    }
  }

  // Updates: lotes seriales (menos frecuentes que altas en import inicial).
  for (const item of toUpdate) {
    const draft = item.draft;
    const sku =
      normalizeIdentifier(draft.sku) ?? normalizeIdentifier(draft.nationalCode);
    const ean = normalizeIdentifier(draft.ean);
    const brand = isBlankCell(draft.brand) ? null : draft.brand;
    const category = isBlankCell(draft.category)
      ? isBlankCell(draft.sourceFamily)
        ? null
        : draft.sourceFamily
      : draft.category;
    const patch: Record<string, unknown> = {
      name: draft.name.trim(),
      source: 'import',
      updated_by: access.profile.id,
    };
    if (sku) patch.sku = sku;
    if (ean) patch.ean = ean;
    if (brand) patch.brand = brand;
    if (category) patch.category = category;
    if (!isBlankCell(draft.description)) patch.description = draft.description;
    if (draft.priceProvided && draft.price != null) patch.price = draft.price;
    if (draft.stockProvided && draft.stock != null) patch.stock = draft.stock;
    if (draft.minStockProvided && draft.minStock != null) {
      patch.min_stock = draft.minStock;
    }

    const { error } = await supabase
      .from('pharmacy_products')
      .update(patch)
      .eq('id', item.id)
      .eq('pharmacy_id', pharmacyId)
      .in('source', ['manual', 'import']);

    if (error) {
      console.error('[catalog] import update', error.code, error.message);
      return { ok: false, error: mapDbError(error.message, error.code) };
    }
    updated += 1;
  }

  // Creates: multi-insert por chunks (objetivo <15s para ~2000 filas).
  for (let i = 0; i < toCreate.length; i += IMPORT_INSERT_CHUNK) {
    const chunk = toCreate.slice(i, i + IMPORT_INSERT_CHUNK).map((draft) =>
      buildImportInsertRow(pharmacyId, access.profile.id, draft)
    );
    const { error } = await supabase.from('pharmacy_products').insert(chunk);
    if (error) {
      console.error('[catalog] import batch create', error.code, error.message);
      return { ok: false, error: mapDbError(error.message, error.code) };
    }
    created += chunk.length;
  }

  revalidatePath(`/f/${pharmacyId}/catalogo`);
  revalidatePath(`/farmacias/${pharmacyId}`);
  return {
    ok: true,
    created,
    updated,
    skipped,
    elapsedMs: Date.now() - started,
    mode: 'batch_insert',
  };
}

/** Archivado / reactivación masiva (misma farmacia). */
export async function bulkSetPharmacyProductsActiveAction(
  pharmacyId: string,
  productIds: string[],
  isActive: boolean
): Promise<ActionResult> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'write');
  if (!access.ok) return { ok: false, error: 'No autorizado.' };
  if (!productIds.length) return { ok: false, error: 'Sin selección.' };
  if (productIds.length > 500) {
    return { ok: false, error: 'Máximo 500 productos por operación.' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('pharmacy_products')
    .update({ is_active: isActive, updated_by: access.profile.id })
    .eq('pharmacy_id', pharmacyId)
    .in('id', productIds)
    .in('source', ['manual', 'import']);

  if (error) {
    return { ok: false, error: mapDbError(error.message, error.code) };
  }
  revalidatePath(`/f/${pharmacyId}/catalogo`);
  revalidatePath(`/farmacias/${pharmacyId}`);
  return { ok: true };
}

/** Categorización masiva por texto (hasta apply de taxonomía 106). */
export async function bulkSetPharmacyProductsCategoryAction(
  pharmacyId: string,
  productIds: string[],
  category: string
): Promise<ActionResult> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'write');
  if (!access.ok) return { ok: false, error: 'No autorizado.' };
  const cat = category.trim();
  if (!cat) return { ok: false, error: 'Categoría vacía.' };
  if (!productIds.length) return { ok: false, error: 'Sin selección.' };
  if (productIds.length > 500) {
    return { ok: false, error: 'Máximo 500 productos por operación.' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('pharmacy_products')
    .update({
      category: cat,
      updated_by: access.profile.id,
    })
    .eq('pharmacy_id', pharmacyId)
    .in('id', productIds)
    .in('source', ['manual', 'import']);

  if (error) {
    return { ok: false, error: mapDbError(error.message, error.code) };
  }
  revalidatePath(`/f/${pharmacyId}/catalogo`);
  revalidatePath(`/farmacias/${pharmacyId}`);
  return { ok: true };
}
