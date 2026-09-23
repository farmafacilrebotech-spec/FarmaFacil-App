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
  suggestProductColumnMapping,
  type ProductImportDraft,
} from '@/lib/pharmacies/product-import';
import { parseSpreadsheetFile } from '@/lib/import/parse-file';
import type { ColumnMapping } from '@/lib/import/spreadsheet';
import { createClient } from '@/lib/supabase/server';
import { requireActivePharmacyMembership } from '@/lib/auth/access';
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
  const access = await requireActivePharmacyMembership(pharmacyId);
  if (!access.ok) return { ok: false, error: 'No autorizado.' };

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
    parsed.data
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
  return { ok: true, productId: data.id as string };
}

export async function updatePharmacyProductAction(
  pharmacyId: string,
  productId: string,
  raw: PharmacyProductInput
): Promise<ActionResult> {
  const access = await requireActivePharmacyMembership(pharmacyId);
  if (!access.ok) return { ok: false, error: 'No autorizado.' };

  const parsed = pharmacyProductInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Datos no válidos.',
    };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('pharmacy_products')
    .update(toProductUpdate(access.profile.id, parsed.data))
    .eq('id', productId)
    .eq('pharmacy_id', pharmacyId);

  if (error) {
    console.error('[catalog] update', error.code, error.message);
    return { ok: false, error: mapDbError(error.message, error.code) };
  }

  revalidatePath(`/f/${pharmacyId}/catalogo`);
  return { ok: true };
}

export async function setPharmacyProductActiveAction(
  pharmacyId: string,
  productId: string,
  isActive: boolean
): Promise<ActionResult> {
  const access = await requireActivePharmacyMembership(pharmacyId);
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
export async function previewProductImportAction(
  pharmacyId: string,
  formData: FormData
): Promise<PreviewImportResult> {
  const access = await requireActivePharmacyMembership(pharmacyId);
  if (!access.ok) return { ok: false, error: 'No autorizado.' };

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
    }
  | { ok: false; error: string };

/**
 * Paso 4: persiste altas/actualizaciones ya validadas.
 * Solo filas create/update; campos no presentes en el draft no se anulan en update.
 */
export async function confirmProductImportAction(
  pharmacyId: string,
  payload: {
    rows: Array<{
      action: 'create' | 'update' | 'skip';
      matchedProductId: string | null;
      draft: ProductImportDraft;
    }>;
  }
): Promise<ConfirmImportResult> {
  const access = await requireActivePharmacyMembership(pharmacyId);
  if (!access.ok) return { ok: false, error: 'No autorizado.' };

  const rows = payload.rows ?? [];
  if (rows.length === 0) {
    return { ok: false, error: 'No hay filas para importar.' };
  }
  if (rows.length > 2000) {
    return { ok: false, error: 'Demasiadas filas en la importación.' };
  }

  const supabase = createClient();
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.action === 'skip') {
      skipped += 1;
      continue;
    }

    const draft = row.draft;
    if (!draft?.name?.trim()) {
      skipped += 1;
      continue;
    }

    if (row.action === 'update' && row.matchedProductId) {
      const patch: Record<string, unknown> = {
        name: draft.name.trim(),
        updated_by: access.profile.id,
      };
      if (draft.sku !== undefined) patch.sku = draft.sku;
      if (draft.ean !== undefined) patch.ean = draft.ean;
      if (draft.brand !== undefined) patch.brand = draft.brand;
      if (draft.category !== undefined) patch.category = draft.category;
      if (draft.description !== undefined) patch.description = draft.description;
      if (draft.priceProvided && draft.price != null) patch.price = draft.price;
      if (draft.stockProvided && draft.stock != null) patch.stock = draft.stock;
      if (draft.minStockProvided && draft.minStock != null) {
        patch.min_stock = draft.minStock;
      }

      const { error } = await supabase
        .from('pharmacy_products')
        .update(patch)
        .eq('id', row.matchedProductId)
        .eq('pharmacy_id', pharmacyId);

      if (error) {
        console.error('[catalog] import update', error.code, error.message);
        return { ok: false, error: mapDbError(error.message, error.code) };
      }
      updated += 1;
      continue;
    }

    const insertPayload = {
      pharmacy_id: pharmacyId,
      sku: draft.sku,
      ean: draft.ean,
      name: draft.name.trim(),
      description: draft.description,
      brand: draft.brand,
      category: draft.category,
      price: draft.priceProvided && draft.price != null ? draft.price : 0,
      stock: draft.stockProvided && draft.stock != null ? draft.stock : 0,
      min_stock:
        draft.minStockProvided && draft.minStock != null ? draft.minStock : 0,
      is_active: true,
      is_featured: false,
      created_by: access.profile.id,
      updated_by: access.profile.id,
    };

    const { error } = await supabase.from('pharmacy_products').insert(insertPayload);
    if (error) {
      console.error('[catalog] import create', error.code, error.message);
      return { ok: false, error: mapDbError(error.message, error.code) };
    }
    created += 1;
  }

  revalidatePath(`/f/${pharmacyId}/catalogo`);
  return { ok: true, created, updated, skipped };
}
