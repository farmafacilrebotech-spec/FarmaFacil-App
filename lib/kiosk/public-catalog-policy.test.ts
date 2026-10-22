import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { productVisibleInActiveCatalog } from '../catalog/master-catalog.ts';
import { catalogModeForCommercialPlan } from '../catalog/catalog-mode.ts';

/**
 * Políticas de catálogo público / kiosko (sin DB):
 * - Genérico no se mezcla con propio en listados activos.
 * - Planes comerciales determinan modalidad.
 */
describe('public/kiosk catalog modality policy', () => {
  it('Piloto/General solo ven generic|demo', () => {
    const mode = catalogModeForCommercialPlan('general');
    assert.equal(productVisibleInActiveCatalog('generic', mode), true);
    assert.equal(productVisibleInActiveCatalog('demo', mode), true);
    assert.equal(productVisibleInActiveCatalog('import', mode), false);
    assert.equal(productVisibleInActiveCatalog('manual', mode), false);
  });

  it('Personalizado ve manual|import|demo (no generic)', () => {
    const mode = catalogModeForCommercialPlan('personalized');
    assert.equal(productVisibleInActiveCatalog('import', mode), true);
    assert.equal(productVisibleInActiveCatalog('manual', mode), true);
    assert.equal(productVisibleInActiveCatalog('demo', mode), true);
    assert.equal(productVisibleInActiveCatalog('generic', mode), false);
  });

  it('cambio de plan implica cambio de filtro, no DELETE', () => {
    // Los productos genéricos siguen existiendo en DB pero dejan de listarse.
    assert.equal(
      productVisibleInActiveCatalog('generic', 'own'),
      false
    );
    assert.equal(
      productVisibleInActiveCatalog('generic', 'generic'),
      true
    );
  });
});
