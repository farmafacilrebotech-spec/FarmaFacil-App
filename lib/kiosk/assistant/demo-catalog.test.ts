import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isDemoCatalogProductId,
  searchDemoCatalog,
} from './demo-catalog.ts';

describe('demo catalog', () => {
  it('encuentra protector solar / hidratante', () => {
    const solar = searchDemoCatalog({
      queries: ['protector solar', 'solar infantil'],
      limit: 4,
    });
    assert.ok(solar.some((p) => /solar/i.test(p.name)));
    const cream = searchDemoCatalog({
      queries: ['crema hidratante'],
      limit: 4,
    });
    assert.ok(cream.some((p) => /hidrat/i.test(p.name)));
  });

  it('marca ids demo', () => {
    assert.equal(isDemoCatalogProductId('demo-0001-hydratant'), true);
    assert.equal(isDemoCatalogProductId('uuid-real'), false);
  });
});
