/**
 * node --experimental-strip-types --test lib/suppliers/types.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPLIER_QUOTE_STATUS_LABELS,
  SUPPLIER_QUOTE_STATUSES,
  SUPPLIER_DOCS_BUCKET,
} from './types.ts';

describe('supplier quote statuses', () => {
  it('cubre el ciclo comercial acordado', () => {
    assert.deepEqual([...SUPPLIER_QUOTE_STATUSES], [
      'recibido',
      'en_revision',
      'aprobado',
      'rechazado',
      'caducado',
    ]);
    assert.equal(SUPPLIER_QUOTE_STATUS_LABELS.en_revision, 'En revisión');
    assert.equal(SUPPLIER_DOCS_BUCKET, 'supplier-docs');
  });
});
