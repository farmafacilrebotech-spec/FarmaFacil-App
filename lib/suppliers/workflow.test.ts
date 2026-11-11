/**
 * node --experimental-strip-types --test lib/suppliers/workflow.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPLIER_PO_UI_STATUSES,
  SUPPLIER_QUOTE_STATUS_LABELS,
  SUPPLIER_QUOTE_UI_STATUSES,
} from './types.ts';

describe('quote → purchase workflow labels', () => {
  it('UI de presupuesto usa Aceptado para aprobado', () => {
    assert.equal(SUPPLIER_QUOTE_STATUS_LABELS.aprobado, 'Aceptado');
    assert.ok(SUPPLIER_QUOTE_UI_STATUSES.includes('archivado'));
    assert.ok(SUPPLIER_QUOTE_UI_STATUSES.includes('aprobado'));
  });

  it('UI de pedido limita transiciones operativas', () => {
    assert.deepEqual([...SUPPLIER_PO_UI_STATUSES], [
      'borrador',
      'pedido',
      'recibido',
      'cancelado',
    ]);
  });
});
