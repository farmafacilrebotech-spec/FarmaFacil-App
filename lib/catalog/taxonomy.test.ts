/**
 * npm run test:taxonomy
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  FF_COMMERCIAL_CATEGORY_COUNT,
  FF_TAXONOMY_CATEGORIES,
  LEGACY_CATEGORY_ALIASES,
  PENDING_CLASSIFICATION_SLUG,
  getCategoryBySlug,
  listCommercialCategories,
  resolveLegacyCategory,
} from './taxonomy.ts';
import { MASTER_CATEGORY_ICONS } from './category-icons.ts';

describe('taxonomía FarmaFácil', () => {
  it('tiene 26 categorías comerciales y 1 interna', () => {
    const commercial = FF_TAXONOMY_CATEGORIES.filter((c) => c.isCommercial);
    const internal = FF_TAXONOMY_CATEGORIES.filter((c) => !c.isCommercial);
    assert.equal(commercial.length, FF_COMMERCIAL_CATEGORY_COUNT);
    assert.equal(commercial.length, 26);
    assert.equal(internal.length, 1);
    assert.equal(internal[0].slug, PENDING_CLASSIFICATION_SLUG);
  });

  it('slugs y sortOrder únicos', () => {
    const slugs = FF_TAXONOMY_CATEGORIES.map((c) => c.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    const orders = FF_TAXONOMY_CATEGORIES.map((c) => c.sortOrder);
    assert.equal(new Set(orders).size, orders.length);
  });

  it('listCommercialCategories excluye pending_classification y va ordenada', () => {
    const list = listCommercialCategories();
    assert.equal(list.length, 26);
    assert.ok(!list.some((c) => c.slug === PENDING_CLASSIFICATION_SLUG));
    for (let i = 1; i < list.length; i += 1) {
      assert.ok(list[i - 1].sortOrder < list[i].sortOrder);
    }
  });

  it('getCategoryBySlug resuelve y devuelve null si no existe', () => {
    assert.equal(getCategoryBySlug('dermocosmetica')?.name, 'Dermocosmética');
    assert.equal(
      getCategoryBySlug(PENDING_CLASSIFICATION_SLUG)?.isCommercial,
      false
    );
    assert.equal(getCategoryBySlug('no-existe'), null);
    assert.equal(getCategoryBySlug(null), null);
  });

  it('los 8 alias legacy resuelven a categorías comerciales existentes', () => {
    const entries = Object.entries(LEGACY_CATEGORY_ALIASES);
    assert.equal(entries.length, 8);
    for (const [legacyName, slug] of entries) {
      const cat = getCategoryBySlug(slug);
      assert.ok(cat, `slug inexistente para «${legacyName}»: ${slug}`);
      assert.equal(cat.isCommercial, true);
      assert.equal(resolveLegacyCategory(legacyName)?.slug, slug);
    }
    assert.equal(resolveLegacyCategory('cuidado FACIAL')?.slug, 'dermocosmetica');
    assert.equal(resolveLegacyCategory('Otra cosa'), null);
  });

  it('los alias cubren exactamente los 8 nombres del maestro', () => {
    const master = MASTER_CATEGORY_ICONS.map((r) => r.categoryName).sort();
    assert.deepEqual(Object.keys(LEGACY_CATEGORY_ALIASES).sort(), master);
  });

  it('reutiliza los iconos de las 8 antiguas y existen en disco', () => {
    for (const row of MASTER_CATEGORY_ICONS) {
      const slug = LEGACY_CATEGORY_ALIASES[row.categoryName];
      assert.equal(getCategoryBySlug(slug)?.iconSrc, row.iconSrc);
    }
    const withIcon = FF_TAXONOMY_CATEGORIES.filter((c) => c.iconSrc);
    assert.equal(withIcon.length, 8);
    for (const c of withIcon) {
      assert.ok(existsSync(join(process.cwd(), 'public', c.iconSrc!)));
    }
  });
});
