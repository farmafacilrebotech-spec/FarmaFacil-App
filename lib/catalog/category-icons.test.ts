import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  MASTER_CATALOG_CATEGORY_COUNT,
  MASTER_CATEGORY_ICONS,
  listCategoriesFromItems,
  resolveMasterCategoryIcon,
} from './category-icons.ts';
import { getValidatedMasterRows } from './master-catalog.ts';

describe('master category icons', () => {
  it('mapea exactamente las 8 categorías del maestro a SVG existentes', () => {
    assert.equal(MASTER_CATEGORY_ICONS.length, MASTER_CATALOG_CATEGORY_COUNT);
    const masterCats = [
      ...new Set(getValidatedMasterRows().map((r) => r.category_name)),
    ].sort();
    const mapped = MASTER_CATEGORY_ICONS.map((r) => r.categoryName).sort();
    assert.deepEqual(mapped, masterCats);

    for (const row of MASTER_CATEGORY_ICONS) {
      const disk = join(process.cwd(), 'public', row.iconSrc.replace(/^\//, ''));
      assert.equal(existsSync(disk), true, row.iconSrc);
      assert.ok(row.iconSrc.endsWith('.svg'));
    }
  });

  it('resuelve por nombre y no inventa categorías', () => {
    assert.equal(
      resolveMasterCategoryIcon('Protección solar')?.slug,
      'proteccion-solar'
    );
    assert.equal(resolveMasterCategoryIcon('Categoría inventada'), null);
  });

  it('ordena categorías presentes según maestro', () => {
    const cats = listCategoriesFromItems([
      { category: 'Protección solar' },
      { category: 'Cuidado facial' },
      { category: 'Protección solar' },
    ]);
    assert.deepEqual(cats, ['Cuidado facial', 'Protección solar']);
  });

});
