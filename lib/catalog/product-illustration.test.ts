import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { resolveMasterCategoryIcon } from './category-icons.ts';
import { getValidatedMasterRows } from './master-catalog.ts';
import {
  countIllustrationCoverage,
  PRODUCT_FORMAT_SLUGS,
  PRODUCT_ILLUSTRATION_PLACEHOLDER,
  resolveProductIllustration,
} from './product-illustration.ts';

function categoryFallback(category: string | null) {
  const icon = resolveMasterCategoryIcon(category);
  return icon ? { src: icon.iconSrc, slug: icon.slug } : null;
}

function resolve(input: {
  name: string;
  category: string | null;
  subcategory: string | null;
}) {
  return resolveProductIllustration(input, categoryFallback(input.category));
}

describe('product illustration resolver', () => {
  it('asigna formatos específicos sin confundir categorías', () => {
    const spray = resolve({
      name: 'Protector solar en spray SPF 30',
      category: 'Protección solar',
      subcategory: 'Formatos específicos',
    });
    assert.equal(spray.kind, 'format');
    assert.equal(spray.slug, 'spray');

    const termo = resolve({
      name: 'Termómetro digital',
      category: 'Primeros auxilios y cuidado en casa',
      subcategory: 'Medición y cuidado en casa',
    });
    assert.equal(termo.slug, 'termometro');

    const menstrual = resolve({
      name: 'Compresa higiénica normal',
      category: 'Bienestar y cuidado estacional',
      subcategory: 'Higiene menstrual',
    });
    assert.equal(menstrual.slug, 'higiene-menstrual');
  });

  it('cae a icono de categoría si no hay formato verificable', () => {
    const facial = resolve({
      name: 'Producto facial genérico sin envase claro',
      category: 'Cuidado facial',
      subcategory: 'Cuidado cosmético específico',
    });
    assert.equal(facial.kind, 'category');
    assert.equal(facial.slug, 'cuidado-facial');
  });

  it('usa placeholder si la categoría no es del maestro', () => {
    const unknown = resolveProductIllustration(
      {
        name: 'Artículo desconocido',
        category: 'Categoría inventada',
        subcategory: null,
      },
      null
    );
    assert.equal(unknown.kind, 'placeholder');
    assert.equal(unknown.src, PRODUCT_ILLUSTRATION_PLACEHOLDER);
  });

  it('archivos format y placeholder existen en public/', () => {
    const root = process.cwd();
    for (const slug of PRODUCT_FORMAT_SLUGS) {
      const path = join(
        root,
        'public/images/catalog-proposal/formats',
        `${slug}.svg`
      );
      assert.equal(existsSync(path), true, path);
    }
    assert.equal(
      existsSync(join(root, 'public', PRODUCT_ILLUSTRATION_PLACEHOLDER.slice(1))),
      true
    );
  });

  it('cubre los 100 del maestro con format o category (sin placeholder masivo)', () => {
    const rows = getValidatedMasterRows().map((r) => ({
      name: r.generic_product_type,
      category: r.category_name,
      subcategory: r.subcategory_name,
    }));
    const cov = countIllustrationCoverage(rows, categoryFallback);
    assert.equal(cov.total, 100);
    assert.equal(cov.placeholder, 0);
    assert.ok(cov.format > 0);
    assert.ok(cov.category > 0);
    assert.equal(cov.format + cov.category, 100);
  });
});
