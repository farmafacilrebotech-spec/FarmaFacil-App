/**
 * node --experimental-strip-types --test lib/suppliers/types.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_CATEGORY_LABELS,
  SUPPLIER_QUOTE_STATUS_LABELS,
  SUPPLIER_QUOTE_STATUSES,
  SUPPLIER_PO_STATUSES,
  SUPPLIER_DOCS_BUCKET,
  isSupplierCategory,
} from './types.ts';

describe('supplier categories', () => {
  it('incluye el catálogo comercial aprobado', () => {
    assert.deepEqual([...SUPPLIER_CATEGORIES], [
      'merchandising',
      'papeleria',
      'imprentas',
      'marketing',
      'kioskos',
      'tecnologia',
      'servicios',
      'otros',
    ]);
    assert.equal(SUPPLIER_CATEGORY_LABELS.papeleria, 'Papelería');
    assert.equal(isSupplierCategory('kioskos'), true);
    assert.equal(isSupplierCategory('starter'), false);
  });
});

describe('supplier quote and purchase statuses', () => {
  it('cubre el ciclo comercial acordado (076+077)', () => {
    assert.deepEqual([...SUPPLIER_QUOTE_STATUSES], [
      'recibido',
      'en_revision',
      'aprobado',
      'rechazado',
      'caducado',
      'archivado',
    ]);
    assert.equal(SUPPLIER_QUOTE_STATUS_LABELS.en_revision, 'En revisión');
    assert.equal(SUPPLIER_QUOTE_STATUS_LABELS.aprobado, 'Aceptado');
    assert.equal(SUPPLIER_QUOTE_STATUS_LABELS.archivado, 'Archivado');
    assert.ok(SUPPLIER_PO_STATUSES.includes('facturado'));
    assert.equal(SUPPLIER_DOCS_BUCKET, 'supplier-docs');
  });
});
