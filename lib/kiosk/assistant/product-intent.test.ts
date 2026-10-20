import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractCatalogSearchQueries,
  isProductSeekingMessage,
  sanitizeSearchLiteral,
} from './product-intent.ts';

describe('product intent', () => {
  it('detecta consultas de producto típicas', () => {
    assert.equal(
      isProductSeekingMessage('Busco una crema hidratante para piel seca'),
      true
    );
    assert.equal(
      isProductSeekingMessage('¿Tenéis protector solar infantil?'),
      true
    );
    assert.equal(
      isProductSeekingMessage('¿Qué horario tenéis los domingos?'),
      false
    );
  });

  it('extrae consultas literales sin comodines SQL', () => {
    const qs = extractCatalogSearchQueries(
      'Busco una crema hidratante para piel seca'
    );
    assert.ok(qs.length >= 1);
    assert.ok(qs.some((q) => /hidrat/i.test(q)));
    for (const q of qs) {
      assert.equal(q.includes('%'), false);
      assert.equal(q.includes('_'), false);
    }
  });

  it('sanitiza literales peligrosos', () => {
    assert.equal(sanitizeSearchLiteral('a%b_c\\d').includes('%'), false);
    assert.equal(sanitizeSearchLiteral('x').length, 0);
  });
});
