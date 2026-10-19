import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  escapeIlikeLiteral,
  ilikeContainsLiteral,
} from './ilike-escape.ts';

describe('escapeIlikeLiteral — %, _, \\ literales (espejo 043)', () => {
  it('escapa barra invertida, porcentaje y guion bajo en ese orden', () => {
    assert.equal(escapeIlikeLiteral('100%'), '100\\%');
    assert.equal(escapeIlikeLiteral('a_b'), 'a\\_b');
    assert.equal(escapeIlikeLiteral('a\\b'), 'a\\\\b');
    assert.equal(escapeIlikeLiteral('50%_off\\x'), '50\\%\\_off\\\\x');
  });

  it('una búsqueda con % no actúa como comodín (match literal)', () => {
    const products = ['Vitamina 100%', 'Vitamina 1000', 'Gel 50% urea'];
    const q = '100%';
    const escaped = escapeIlikeLiteral(q);
    assert.equal(escaped, '100\\%');
    // Tras escape, solo entra el producto que contiene el literal "100%"
    const matched = products.filter((name) => ilikeContainsLiteral(name, q));
    assert.deepEqual(matched, ['Vitamina 100%']);
    assert.ok(!matched.includes('Vitamina 1000'));
  });

  it('una búsqueda con _ no actúa como comodín de un carácter', () => {
    const products = ['SKU_A1', 'SKUxA1', 'SKU-A1'];
    const q = 'SKU_A1';
    const matched = products.filter((name) => ilikeContainsLiteral(name, q));
    assert.deepEqual(matched, ['SKU_A1']);
  });

  it('la migración 043 aplica ESCAPE y replace de \\ % _', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const sql = readFileSync(
      join(here, '../../supabase/migrations/043_kiosk_search_products_v1.sql'),
      'utf8'
    );
    assert.match(sql, /v_q_like/);
    assert.match(sql, /ESCAPE E'\\\\'/);
    assert.match(sql, /replace\(v_q, E'\\\\', E'\\\\\\\\'\)/);
    assert.ok(sql.includes("E'\\\\%'"));
    assert.ok(sql.includes("E'\\\\_'"));
    // No debe quedar ILIKE con v_q crudo (sin escape)
    assert.equal(/\|\|\s*v_q\s*\|\|/.test(sql), false);
  });
});
