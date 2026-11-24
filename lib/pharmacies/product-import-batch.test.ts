import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PRODUCT_IMPORT_BATCH_SIZE,
  chunkArray,
  draftToBatchRpcRow,
  runProductImportBatches,
  type ProductImportBatchAction,
  type ProductImportBatchResult,
} from './product-import-batch.ts';
import {
  applyEquivalencesToDrafts,
  equivalenceLookupKey,
  findEquivalence,
  uniqueSourceFamilies,
  type CategoryEquivalence,
} from './import-equivalences.ts';
import {
  isBlankProductDraft,
  isInvalidProductName,
  isJunkStructuralRow,
} from './product-import-validate.ts';

type ProductImportDraft = {
  rowIndex: number;
  sku: string | null;
  ean: string | null;
  nationalCode: string | null;
  name: string;
  brand: string | null;
  laboratory: string | null;
  category: string | null;
  sourceFamily: string | null;
  sourceSubfamily: string | null;
  description: string | null;
  price: number | null;
  stock: number | null;
  minStock: number | null;
  priceProvided: boolean;
  stockProvided: boolean;
  minStockProvided: boolean;
};

function draft(
  partial: Partial<ProductImportDraft> & { rowIndex: number }
): ProductImportDraft {
  return {
    name: 'Producto test',
    sku: null,
    ean: null,
    nationalCode: null,
    brand: null,
    laboratory: null,
    category: null,
    sourceFamily: null,
    sourceSubfamily: null,
    description: null,
    price: null,
    stock: null,
    minStock: null,
    priceProvided: false,
    stockProvided: false,
    minStockProvided: false,
    ...partial,
  };
}

/** Espejo local de shouldPersistImportRow (evita cargar product-import.ts con alias @/). */
function shouldPersist(row: {
  action: string;
  draft: ProductImportDraft;
}): boolean {
  if (row.action === 'skip' || row.action === 'unchanged') return false;
  if (
    isBlankProductDraft(row.draft) ||
    isInvalidProductName(row.draft.name) ||
    isJunkStructuralRow(row.draft)
  ) {
    return false;
  }
  return (
    row.action === 'create' ||
    row.action === 'update' ||
    row.action === 'pending_classification'
  );
}

describe('product-import-batch', () => {
  it('chunkArray parte en lotes de 100', () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    const chunks = chunkArray(items, PRODUCT_IMPORT_BATCH_SIZE);
    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].length, 100);
    assert.equal(chunks[2].length, 50);
  });

  it('runProductImportBatches reporta progreso real y acumula', async () => {
    const progress: number[] = [];
    const action: ProductImportBatchAction = async (_pharmacyId, payload) => {
      const result: ProductImportBatchResult = {
        ok: true,
        jobId: payload.jobId,
        created: payload.rows.length,
        updated: 0,
        skipped: 0,
        errors: 0,
        replayed: 0,
        errorRows: [],
      };
      return result;
    };

    const rows = Array.from({ length: 230 }, (_, i) => ({
      matchedProductId: null,
      draft: draft({ rowIndex: i + 1, name: `P${i}`, ean: String(1000 + i) }),
    }));

    const res = await runProductImportBatches({
      pharmacyId: 'pharm-a',
      rows,
      action,
      jobId: '11111111-1111-4111-8111-111111111111',
      onProgress: (p) => progress.push(p.processedRows),
    });

    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.totals.created, 230);
    assert.equal(res.totals.batches, 3);
    assert.deepEqual(progress, [100, 200, 230]);
  });

  it('mismo jobId es reutilizable tras fallo de lote', async () => {
    let calls = 0;
    const action: ProductImportBatchAction = async (_id, payload) => {
      calls += 1;
      if (calls === 1) return { ok: false, error: 'boom' };
      return {
        ok: true,
        jobId: payload.jobId,
        created: payload.rows.length,
        updated: 0,
        skipped: 0,
        errors: 0,
        replayed: 0,
        errorRows: [],
      };
    };
    const rows = [
      { matchedProductId: null, draft: draft({ rowIndex: 1, name: 'A' }) },
    ];
    const first = await runProductImportBatches({
      pharmacyId: 'pharm-a',
      rows,
      action,
      jobId: '22222222-2222-4222-8222-222222222222',
    });
    assert.equal(first.ok, false);
    const second = await runProductImportBatches({
      pharmacyId: 'pharm-a',
      rows,
      action,
      jobId: '22222222-2222-4222-8222-222222222222',
    });
    assert.equal(second.ok, true);
  });

  it('draftToBatchRpcRow usa snake_case', () => {
    const row = draftToBatchRpcRow(
      draft({
        rowIndex: 3,
        name: 'X',
        nationalCode: '123',
        sourceFamily: 'FAM',
      })
    );
    assert.equal(row.row_index, 3);
    assert.equal(row.national_code, '123');
    assert.equal(row.source_family, 'FAM');
  });
});

describe('import-equivalences + pending persist', () => {
  it('uniqueSourceFamilies deduplica', () => {
    const fams = uniqueSourceFamilies([
      { sourceFamily: 'Solar', sourceSubfamily: 'SPF50' },
      { sourceFamily: 'Solar', sourceSubfamily: 'SPF50' },
      { sourceFamily: 'Solar', sourceSubfamily: null },
      { sourceFamily: null },
    ]);
    assert.equal(fams.length, 2);
  });

  it('aplica equivalencias a drafts sin categoría', () => {
    const eqs: CategoryEquivalence[] = [
      {
        pharmacyId: 'p',
        supplierKey: null,
        sourceFormat: null,
        sourceFamily: 'SOLAR',
        sourceSubfamily: null,
        categorySlug: 'proteccion_solar',
        categoryName: 'Protección solar',
      },
    ];
    const out = applyEquivalencesToDrafts(
      [
        {
          category: null,
          sourceFamily: 'Solar',
          sourceSubfamily: null,
        },
      ],
      eqs
    );
    assert.equal(out[0].category, 'Protección solar');
    assert.equal(
      findEquivalence('Solar', null, eqs)?.categorySlug,
      'proteccion_solar'
    );
    assert.equal(
      equivalenceLookupKey({
        supplierKey: null,
        sourceFormat: null,
        sourceFamily: 'Solar',
        sourceSubfamily: null,
      }),
      '||solar|'
    );
  });

  it('shouldPersist acepta pending_classification válidos', () => {
    assert.equal(
      shouldPersist({
        action: 'pending_classification',
        draft: draft({ rowIndex: 1, name: 'Crema solar', sourceFamily: 'SOL' }),
      }),
      true
    );
    assert.equal(
      shouldPersist({
        action: 'skip',
        draft: draft({ rowIndex: 2, name: '0' }),
      }),
      false
    );
  });

  it('aislamiento lógico: misma key de familia, distinta farmacia', () => {
    const a: CategoryEquivalence = {
      pharmacyId: 'pharm-a',
      supplierKey: 'COFARES',
      sourceFormat: 'xlsx',
      sourceFamily: 'X',
      sourceSubfamily: null,
      categorySlug: 'dermocosmetica',
      categoryName: 'Dermocosmética',
    };
    const b = {
      ...a,
      pharmacyId: 'pharm-b',
      categorySlug: 'mascotas',
      categoryName: 'Mascotas',
    };
    assert.equal(equivalenceLookupKey(a), equivalenceLookupKey(b));
    assert.notEqual(a.pharmacyId, b.pharmacyId);
  });
});
