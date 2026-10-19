import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assertCatalogItemsBelongToPharmacy } from './catalog-guards.ts';

describe('kiosk catalog isolation helpers', () => {
  it('acepta ítems sin pharmacyId embebido o con el mismo id', () => {
    const pharmacyId = '11111111-1111-4111-8111-111111111111';
    assert.equal(
      assertCatalogItemsBelongToPharmacy(pharmacyId, [
        {},
        { pharmacyId },
      ]),
      true
    );
  });

  it('rechaza ítems de otra farmacia (defensa en profundidad TS)', () => {
    const pharmacyId = '11111111-1111-4111-8111-111111111111';
    const other = '22222222-2222-4222-8222-222222222222';
    assert.equal(
      assertCatalogItemsBelongToPharmacy(pharmacyId, [{ pharmacyId: other }]),
      false
    );
  });
});
