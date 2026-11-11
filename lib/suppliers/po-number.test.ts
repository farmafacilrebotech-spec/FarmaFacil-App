/**
 * node --experimental-strip-types --test lib/suppliers/po-number.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatPurchaseOrderNumber,
  nextSequenceForYear,
  numberingYearFromOrderedAt,
  parsePurchaseOrderNumber,
} from './po-number.ts';

describe('numeración anual de pedidos', () => {
  it('formatea YYYY/00000001', () => {
    assert.equal(formatPurchaseOrderNumber(2026, 1), '2026/00000001');
    assert.equal(formatPurchaseOrderNumber(2026, 12), '2026/00000012');
    assert.equal(formatPurchaseOrderNumber(2027, 1), '2027/00000001');
  });

  it('reinicia el contador cada año', () => {
    const counters = new Map<number, number>();
    assert.equal(nextSequenceForYear(counters, 2026).number, '2026/00000001');
    assert.equal(nextSequenceForYear(counters, 2026).number, '2026/00000002');
    assert.equal(nextSequenceForYear(counters, 2027).number, '2027/00000001');
    assert.equal(nextSequenceForYear(counters, 2026).number, '2026/00000003');
  });

  it('parsea y valida', () => {
    assert.deepEqual(parsePurchaseOrderNumber('2026/00000001'), {
      year: 2026,
      seq: 1,
    });
    assert.equal(parsePurchaseOrderNumber('2026/1'), null);
    assert.equal(numberingYearFromOrderedAt('2026-11-10'), 2026);
  });
});
