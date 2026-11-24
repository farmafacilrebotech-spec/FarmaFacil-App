/**
 * Importación de catálogo por lotes (cliente → server action).
 * Pure TS: sin dependencias de React ni de Supabase.
 *
 * Cada lote se envía a una server action que invoca
 * ff_pharmacy_products_import_batch_v1 (supabase/proposed/107).
 */

import type { ProductImportDraft } from '@/lib/pharmacies/product-import';

export const PRODUCT_IMPORT_BATCH_SIZE = 100;

export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError('chunkArray: size debe ser un entero >= 1');
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export type ProductImportBatchRow = {
  matchedProductId: string | null;
  draft: ProductImportDraft;
};

export type ProductImportBatchPayload = {
  /** Identificador del job; se genera en cliente para que los reintentos sean idempotentes. */
  jobId: string;
  sourceFilename: string | null;
  rows: ProductImportBatchRow[];
  /** true solo en el último lote: cierra el job. */
  finalize: boolean;
};

export type ProductImportBatchError = {
  rowIndex: number;
  message: string;
};

export type ProductImportBatchResult =
  | {
      ok: true;
      jobId: string;
      created: number;
      updated: number;
      skipped: number;
      errors: number;
      replayed: number;
      errorRows: ProductImportBatchError[];
    }
  | { ok: false; error: string };

/** Forma esperada de la server action (p. ej. confirmProductImportBatchAction). */
export type ProductImportBatchAction = (
  pharmacyId: string,
  payload: ProductImportBatchPayload
) => Promise<ProductImportBatchResult>;

export type ProductImportBatchTotals = {
  jobId: string;
  batches: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  replayed: number;
  errorRows: ProductImportBatchError[];
};

export type ProductImportBatchProgress = {
  batchIndex: number;
  batchCount: number;
  processedRows: number;
  totalRows: number;
};

export type RunProductImportBatchesResult =
  | { ok: true; totals: ProductImportBatchTotals }
  | {
      ok: false;
      error: string;
      /** Totales acumulados hasta el fallo; reintentar con el mismo jobId es seguro. */
      totals: ProductImportBatchTotals;
    };

function newJobId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Parte las filas en lotes de 100 y las envía en serie. Se detiene en el
 * primer lote con error de acción; los errores por fila no cortan la importación.
 */
export async function runProductImportBatches(options: {
  pharmacyId: string;
  rows: readonly ProductImportBatchRow[];
  action: ProductImportBatchAction;
  sourceFilename?: string | null;
  /** Reutilizar para reintentos idempotentes. */
  jobId?: string;
  batchSize?: number;
  onProgress?: (progress: ProductImportBatchProgress) => void;
}): Promise<RunProductImportBatchesResult> {
  const jobId = options.jobId ?? newJobId();
  const batches = chunkArray(
    options.rows,
    options.batchSize ?? PRODUCT_IMPORT_BATCH_SIZE
  );
  const totals: ProductImportBatchTotals = {
    jobId,
    batches: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    replayed: 0,
    errorRows: [],
  };

  let processedRows = 0;
  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const result = await options.action(options.pharmacyId, {
      jobId,
      sourceFilename: options.sourceFilename ?? null,
      rows: batch,
      finalize: i === batches.length - 1,
    });

    if (!result.ok) {
      return { ok: false, error: result.error, totals };
    }

    totals.batches += 1;
    totals.created += result.created;
    totals.updated += result.updated;
    totals.skipped += result.skipped;
    totals.errors += result.errors;
    totals.replayed += result.replayed;
    totals.errorRows.push(...result.errorRows);

    processedRows += batch.length;
    options.onProgress?.({
      batchIndex: i + 1,
      batchCount: batches.length,
      processedRows,
      totalRows: options.rows.length,
    });
  }

  return { ok: true, totals };
}

/**
 * Convierte un draft al formato snake_case que espera
 * ff_pharmacy_products_import_batch_v1 (p_rows).
 */
export function draftToBatchRpcRow(
  draft: ProductImportDraft
): Record<string, unknown> {
  return {
    row_index: draft.rowIndex,
    name: draft.name,
    sku: draft.sku,
    ean: draft.ean,
    national_code: draft.nationalCode,
    brand: draft.brand,
    laboratory: draft.laboratory,
    category: draft.category,
    source_family: draft.sourceFamily,
    source_subfamily: draft.sourceSubfamily,
    description: draft.description,
    price: draft.price,
    stock: draft.stock,
    min_stock: draft.minStock,
    price_provided: draft.priceProvided,
    stock_provided: draft.stockProvided,
    min_stock_provided: draft.minStockProvided,
  };
}
