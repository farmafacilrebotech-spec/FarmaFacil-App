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
import type {
  ProductImportBatchPayload,
  ProductImportBatchResult,
} from '@/lib/pharmacies/product-import-batch';
import { draftToBatchRpcRow } from '@/lib/pharmacies/product-import-batch';
import type { CategoryEquivalence } from '@/lib/pharmacies/import-equivalences';
import {
  PENDING_CLASSIFICATION_NAME,
  isPendingClassificationCategory,
  listCommercialCategories,
} from '@/lib/catalog/taxonomy';
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
  draft: ProductImportDraft,
  options?: { pending?: boolean }
) {
  const pending = options?.pending === true;
  const sku =
    normalizeIdentifier(draft.sku) ?? normalizeIdentifier(draft.nationalCode);
  const ean = normalizeIdentifier(draft.ean);
  const brand = isBlankCell(draft.brand) ? null : draft.brand;
  let category: string | null;
  if (pending) {
    category = PENDING_CLASSIFICATION_NAME;
  } else if (!isBlankCell(draft.category)) {
    category = draft.category;
  } else if (!isBlankCell(draft.sourceFamily)) {
    category = draft.sourceFamily;
  } else {
    category = null;
  }
  return {
    pharmacy_id: pharmacyId,
    sku,
    ean,
    name: draft.name.trim(),
    description: isBlankCell(draft.description) ? null : draft.description,
    brand,
    category,
    price: draft.priceProvided && draft.price != null ? draft.price : 0,
    // Stock opcional en Excel. BD exige NOT NULL DEFAULT 0 (020): 0 aquí
    // significa «no informado en FarmaFácil», no «agotado» comercial.
    stock: draft.stockProvided && draft.stock != null ? draft.stock : 0,
    min_stock:
      draft.minStockProvided && draft.minStock != null ? draft.minStock : 0,
    // Pendientes no entran en catálogos comerciales (kiosko/cliente).
    is_active: pending ? false : true,
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
 * Preferir confirmProductImportBatchAction desde el cliente para progreso real.
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
    sourceFilename?: string | null;
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
  const createdIds: string[] = [];

  const toCreate: Array<{ draft: ProductImportDraft; pending: boolean }> = [];
  const toUpdate: Array<{ id: string; draft: ProductImportDraft }> = [];

  for (const row of rows) {
    if (!shouldPersistImportRow(row)) {
      skipped += 1;
      continue;
    }
    if (row.action === 'update' && row.matchedProductId) {
      toUpdate.push({ id: row.matchedProductId, draft: row.draft });
    } else {
      toCreate.push({
        draft: row.draft,
        pending: row.action === 'pending_classification',
      });
    }
  }

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

  for (let i = 0; i < toCreate.length; i += IMPORT_INSERT_CHUNK) {
    const slice = toCreate.slice(i, i + IMPORT_INSERT_CHUNK);
    const chunk = slice.map((item) =>
      buildImportInsertRow(pharmacyId, access.profile.id, item.draft, {
        pending: item.pending,
      })
    );
    const { data, error } = await supabase
      .from('pharmacy_products')
      .insert(chunk)
      .select('id');
    if (error) {
      console.error('[catalog] import batch create', error.code, error.message);
      return { ok: false, error: mapDbError(error.message, error.code) };
    }
    created += chunk.length;
    for (const row of data ?? []) {
      if (row?.id) createdIds.push(row.id as string);
    }
  }

  // Best-effort job registry (tabla proposed/090; ignore if missing).
  await tryRecordImportJob(supabase, {
    pharmacyId,
    profileId: access.profile.id,
    jobId: crypto.randomUUID(),
    sourceFilename: payload.sourceFilename ?? null,
    created,
    updated,
    skipped,
    createdIds,
  });

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

/**
 * Lote cliente → servidor (progreso real). Intenta RPC 090; fallback insert.
 */
export async function confirmProductImportBatchAction(
  pharmacyId: string,
  payload: ProductImportBatchPayload
): Promise<ProductImportBatchResult> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'write');
  if (!access.ok) return { ok: false, error: 'No autorizado.' };
  const modeGate = await requireOwnCatalogMode(pharmacyId);
  if (!modeGate.ok) return { ok: false, error: modeGate.error };

  if (!payload.jobId || !payload.rows?.length) {
    return { ok: false, error: 'Lote vacío o sin jobId.' };
  }
  if (payload.rows.length > IMPORT_INSERT_CHUNK) {
    return { ok: false, error: 'Lote demasiado grande.' };
  }

  const supabase = createClient();

  // RPC path (solo si migración 090 aplicada).
  const rpcRows = payload.rows.map((r) => ({
    matched_product_id: r.matchedProductId,
    ...draftToBatchRpcRow(r.draft),
  }));
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'ff_pharmacy_products_import_batch_v1',
    {
      p_pharmacy_id: pharmacyId,
      p_job_id: payload.jobId,
      p_source_filename: payload.sourceFilename,
      p_rows: rpcRows,
      p_finalize: payload.finalize,
    }
  );

  if (!rpcError && rpcData) {
    const d = rpcData as Record<string, unknown>;
    return {
      ok: true,
      jobId: payload.jobId,
      created: Number(d.created ?? 0),
      updated: Number(d.updated ?? 0),
      skipped: Number(d.skipped ?? 0),
      errors: Number(d.errors ?? 0),
      replayed: Number(d.replayed ?? 0),
      errorRows: Array.isArray(d.error_rows)
        ? (d.error_rows as Array<{ row_index?: number; message?: string }>).map(
            (e) => ({
              rowIndex: Number(e.row_index ?? 0),
              message: String(e.message ?? 'Error'),
            })
          )
        : [],
    };
  }

  // Fallback PostgREST (staging sin 090).
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errorRows: Array<{ rowIndex: number; message: string }> = [];
  const createdIds: string[] = [];

  for (const row of payload.rows) {
    const draft = row.draft;
    if (
      isBlankCell(draft.name) ||
      !shouldPersistImportRow({
        action: row.matchedProductId ? 'update' : 'create',
        draft,
      })
    ) {
      // pending: category vacío + sourceFamily → persist as pending
      const pending =
        isBlankCell(draft.category) && !isBlankCell(draft.sourceFamily);
      if (!pending) {
        skipped += 1;
        continue;
      }
      const insertRow = buildImportInsertRow(
        pharmacyId,
        access.profile.id,
        draft,
        { pending: true }
      );
      const { data, error } = await supabase
        .from('pharmacy_products')
        .insert(insertRow)
        .select('id')
        .single();
      if (error) {
        errorRows.push({
          rowIndex: draft.rowIndex,
          message: mapDbError(error.message, error.code),
        });
        continue;
      }
      created += 1;
      if (data?.id) createdIds.push(data.id);
      continue;
    }

    if (row.matchedProductId) {
      const sku =
        normalizeIdentifier(draft.sku) ??
        normalizeIdentifier(draft.nationalCode);
      const ean = normalizeIdentifier(draft.ean);
      const patch: Record<string, unknown> = {
        name: draft.name.trim(),
        source: 'import',
        updated_by: access.profile.id,
      };
      if (sku) patch.sku = sku;
      if (ean) patch.ean = ean;
      if (!isBlankCell(draft.brand)) patch.brand = draft.brand;
      if (!isBlankCell(draft.category)) patch.category = draft.category;
      else if (!isBlankCell(draft.sourceFamily)) {
        patch.category = draft.sourceFamily;
      }
      if (!isBlankCell(draft.description)) patch.description = draft.description;
      if (draft.priceProvided && draft.price != null) patch.price = draft.price;
      if (draft.stockProvided && draft.stock != null) patch.stock = draft.stock;
      if (draft.minStockProvided && draft.minStock != null) {
        patch.min_stock = draft.minStock;
      }
      const { error } = await supabase
        .from('pharmacy_products')
        .update(patch)
        .eq('id', row.matchedProductId)
        .eq('pharmacy_id', pharmacyId)
        .in('source', ['manual', 'import']);
      if (error) {
        errorRows.push({
          rowIndex: draft.rowIndex,
          message: mapDbError(error.message, error.code),
        });
        continue;
      }
      updated += 1;
    } else {
      const insertRow = buildImportInsertRow(
        pharmacyId,
        access.profile.id,
        draft
      );
      const { data, error } = await supabase
        .from('pharmacy_products')
        .insert(insertRow)
        .select('id')
        .single();
      if (error) {
        errorRows.push({
          rowIndex: draft.rowIndex,
          message: mapDbError(error.message, error.code),
        });
        continue;
      }
      created += 1;
      if (data?.id) createdIds.push(data.id);
    }
  }

  if (payload.finalize || createdIds.length) {
    await tryRecordImportJob(supabase, {
      pharmacyId,
      profileId: access.profile.id,
      jobId: payload.jobId,
      sourceFilename: payload.sourceFilename,
      created,
      updated,
      skipped,
      createdIds,
      finalize: payload.finalize,
    });
  }

  if (payload.finalize) {
    revalidatePath(`/f/${pharmacyId}/catalogo`);
    revalidatePath(`/farmacias/${pharmacyId}`);
  }

  return {
    ok: true,
    jobId: payload.jobId,
    created,
    updated,
    skipped,
    errors: errorRows.length,
    replayed: 0,
    errorRows,
  };
}

async function tryRecordImportJob(
  supabase: ReturnType<typeof createClient>,
  opts: {
    pharmacyId: string;
    profileId: string;
    jobId: string;
    sourceFilename: string | null;
    created: number;
    updated: number;
    skipped: number;
    createdIds: string[];
    finalize?: boolean;
  }
): Promise<void> {
  try {
    const { error } = await supabase.from('pharmacy_catalog_import_jobs').upsert(
      {
        id: opts.jobId,
        pharmacy_id: opts.pharmacyId,
        status: opts.finalize === false ? 'running' : 'completed',
        source_filename: opts.sourceFilename,
        summary: {
          created: opts.created,
          updated: opts.updated,
          skipped: opts.skipped,
        },
        created_by: opts.profileId,
        finished_at:
          opts.finalize === false ? null : new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (error) return;
    if (opts.createdIds.length) {
      await supabase.from('pharmacy_catalog_import_job_items').upsert(
        opts.createdIds.map((productId) => ({
          job_id: opts.jobId,
          product_id: productId,
          action: 'create',
        })),
        { onConflict: 'job_id,product_id' }
      );
    }
  } catch {
    // Tabla 090 no aplicada: silencio.
  }
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

/** Categorización masiva por texto (taxonomía 26 / seed TS hasta apply 089). */
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

  const allowed = new Set(listCommercialCategories().map((c) => c.name));
  if (!allowed.has(cat) && !isPendingClassificationCategory(cat)) {
    return { ok: false, error: 'Categoría no pertenece a la taxonomía FarmaFácil.' };
  }

  const supabase = createClient();
  const patch: Record<string, unknown> = {
    category: cat,
    updated_by: access.profile.id,
  };
  // Clasificar pendientes → activar comercialmente.
  if (allowed.has(cat)) {
    patch.is_active = true;
  }

  const { error } = await supabase
    .from('pharmacy_products')
    .update(patch)
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

export type ImportJobSummary = {
  id: string;
  status: string;
  sourceFilename: string | null;
  createdAt: string;
  finishedAt: string | null;
  summary: Record<string, unknown>;
};

export async function listCatalogImportJobsAction(
  pharmacyId: string
): Promise<{ ok: true; jobs: ImportJobSummary[] } | { ok: false; error: string }> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'read');
  if (!access.ok) return { ok: false, error: 'No autorizado.' };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_catalog_import_jobs')
    .select('id, status, source_filename, created_at, finished_at, summary')
    .eq('pharmacy_id', pharmacyId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    if (
      error.code === '42P01' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return { ok: true, jobs: [] };
    }
    return { ok: false, error: mapDbError(error.message, error.code) };
  }

  return {
    ok: true,
    jobs: (data ?? []).map((j) => ({
      id: j.id as string,
      status: String(j.status),
      sourceFilename: (j.source_filename as string | null) ?? null,
      createdAt: String(j.created_at),
      finishedAt: (j.finished_at as string | null) ?? null,
      summary: (j.summary as Record<string, unknown>) ?? {},
    })),
  };
}

/**
 * Reversión segura: RPC 090 (no sobrescribe edits posteriores) o soft-deactivate
 * de altas del job cuya updated_at ≈ created_at.
 */
export async function revertCatalogImportJobAction(
  pharmacyId: string,
  jobId: string
): Promise<
  | {
      ok: true;
      deactivated: number;
      keptActiveModified: number;
    }
  | { ok: false; error: string }
> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'write');
  if (!access.ok) return { ok: false, error: 'No autorizado.' };
  const modeGate = await requireOwnCatalogMode(pharmacyId);
  if (!modeGate.ok) return modeGate;

  const supabase = createClient();
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'ff_pharmacy_products_import_revert_v1',
    { p_pharmacy_id: pharmacyId, p_job_id: jobId }
  );
  if (!rpcError && rpcData) {
    const d = rpcData as Record<string, unknown>;
    revalidatePath(`/f/${pharmacyId}/catalogo`);
    return {
      ok: true,
      deactivated: Number(d.deactivated ?? 0),
      keptActiveModified: Number(d.kept_active_modified ?? 0),
    };
  }

  // Fallback sin RPC: solo desactiva creates del job no editados después.
  const { data: items, error: itemsError } = await supabase
    .from('pharmacy_catalog_import_job_items')
    .select('product_id')
    .eq('job_id', jobId)
    .eq('action', 'create');
  if (itemsError) {
    return {
      ok: false,
      error:
        'Historial/reversión requiere migración 090 en BD aislada (no aplicada en staging).',
    };
  }
  const ids = (items ?? [])
    .map((i) => i.product_id as string | null)
    .filter((id): id is string => Boolean(id));
  if (!ids.length) {
    return { ok: true, deactivated: 0, keptActiveModified: 0 };
  }

  const { data: products, error: prodError } = await supabase
    .from('pharmacy_products')
    .select('id, created_at, updated_at, is_active')
    .eq('pharmacy_id', pharmacyId)
    .in('id', ids);
  if (prodError) {
    return { ok: false, error: mapDbError(prodError.message, prodError.code) };
  }

  let deactivated = 0;
  let keptActiveModified = 0;
  for (const p of products ?? []) {
    const created = new Date(String(p.created_at)).getTime();
    const updated = new Date(String(p.updated_at)).getTime();
    const untouched = Math.abs(updated - created) <= 1500;
    if (!untouched) {
      keptActiveModified += 1;
      continue;
    }
    if (p.is_active === false) continue;
    const { error } = await supabase
      .from('pharmacy_products')
      .update({ is_active: false, updated_by: access.profile.id })
      .eq('id', p.id)
      .eq('pharmacy_id', pharmacyId);
    if (!error) deactivated += 1;
  }

  await supabase
    .from('pharmacy_catalog_import_jobs')
    .update({
      status: keptActiveModified > 0 ? 'partially_reverted' : 'reverted',
    })
    .eq('id', jobId)
    .eq('pharmacy_id', pharmacyId);

  revalidatePath(`/f/${pharmacyId}/catalogo`);
  return { ok: true, deactivated, keptActiveModified };
}

export async function listImportEquivalencesAction(
  pharmacyId: string
): Promise<
  | { ok: true; items: CategoryEquivalence[]; persisted: boolean }
  | { ok: false; error: string }
> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'read');
  if (!access.ok) return { ok: false, error: 'No autorizado.' };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_category_import_equivalences')
    .select(
      'id, pharmacy_id, supplier_key, source_format, source_family, source_subfamily, category_id, ff_catalog_categories(slug, name)'
    )
    .eq('pharmacy_id', pharmacyId)
    .limit(500);

  if (error) {
    if (
      error.code === '42P01' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return { ok: true, items: [], persisted: false };
    }
    return { ok: false, error: mapDbError(error.message, error.code) };
  }

  const items: CategoryEquivalence[] = (data ?? []).map((row) => {
    const cat = row.ff_catalog_categories as
      | { slug?: string; name?: string }
      | { slug?: string; name?: string }[]
      | null;
    const catObj = Array.isArray(cat) ? cat[0] : cat;
    return {
      id: row.id as string,
      pharmacyId: row.pharmacy_id as string,
      supplierKey: (row.supplier_key as string | null) ?? null,
      sourceFormat: (row.source_format as string | null) ?? null,
      sourceFamily: String(row.source_family),
      sourceSubfamily: (row.source_subfamily as string | null) ?? null,
      categorySlug: String(catObj?.slug ?? ''),
      categoryName: String(catObj?.name ?? ''),
    };
  });
  return { ok: true, items, persisted: true };
}

export async function upsertImportEquivalencesAction(
  pharmacyId: string,
  items: Array<{
    supplierKey?: string | null;
    sourceFormat?: string | null;
    sourceFamily: string;
    sourceSubfamily?: string | null;
    categorySlug: string;
  }>
): Promise<{ ok: true; persisted: boolean } | { ok: false; error: string }> {
  const access = await requirePharmacyCatalogAccess(pharmacyId, 'write');
  if (!access.ok) return { ok: false, error: 'No autorizado.' };
  if (!items.length) return { ok: true, persisted: false };

  const supabase = createClient();
  // Resolve category UUIDs if taxonomy table exists.
  const slugs = Array.from(new Set(items.map((i) => i.categorySlug)));
  const { data: cats, error: catError } = await supabase
    .from('ff_catalog_categories')
    .select('id, slug')
    .in('slug', slugs);

  if (catError) {
    if (
      catError.code === '42P01' ||
      catError.message.toLowerCase().includes('does not exist')
    ) {
      return { ok: true, persisted: false };
    }
    return { ok: false, error: mapDbError(catError.message, catError.code) };
  }

  const idBySlug = new Map(
    (cats ?? []).map((c) => [String(c.slug), String(c.id)])
  );
  const rows = [];
  for (const item of items) {
    const categoryId = idBySlug.get(item.categorySlug);
    if (!categoryId || !item.sourceFamily.trim()) continue;
    rows.push({
      pharmacy_id: pharmacyId,
      supplier_key: item.supplierKey ?? null,
      source_format: item.sourceFormat ?? null,
      source_family: item.sourceFamily.trim(),
      source_subfamily: item.sourceSubfamily ?? null,
      category_id: categoryId,
      confirmed_by: access.profile.id,
      confirmed_at: new Date().toISOString(),
    });
  }
  if (!rows.length) return { ok: true, persisted: false };

  const { error } = await supabase
    .from('pharmacy_category_import_equivalences')
    .upsert(rows, {
      onConflict:
        'pharmacy_id,supplier_key,source_format,source_family,source_subfamily',
    });
  if (error) {
    return { ok: false, error: mapDbError(error.message, error.code) };
  }
  return { ok: true, persisted: true };
}
