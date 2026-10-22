import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  catalogModeForCommercialPlan,
  ownCatalogImportAllowed,
  parseCatalogMode,
  pharmacyMayEditProductSource,
} from './catalog-mode.ts';

describe('catalog mode helpers', () => {
  it('mapea planes comerciales a modalidad', () => {
    assert.equal(catalogModeForCommercialPlan('pilot'), 'generic');
    assert.equal(catalogModeForCommercialPlan('general'), 'generic');
    assert.equal(catalogModeForCommercialPlan('personalized'), 'own');
    assert.equal(catalogModeForCommercialPlan('ai_personalized'), 'own');
  });

  it('bloquea import propio en generic', () => {
    assert.equal(ownCatalogImportAllowed('generic'), false);
    assert.equal(ownCatalogImportAllowed('own'), true);
  });

  it('farmacia no edita genéricos; platform sí', () => {
    assert.equal(
      pharmacyMayEditProductSource('generic', 'generic', false),
      false
    );
    assert.equal(
      pharmacyMayEditProductSource('own', 'generic', false),
      false
    );
    assert.equal(
      pharmacyMayEditProductSource('own', 'import', false),
      true
    );
    assert.equal(
      pharmacyMayEditProductSource('generic', 'generic', true),
      true
    );
  });

  it('parseCatalogMode default generic', () => {
    assert.equal(parseCatalogMode(null), 'generic');
    assert.equal(parseCatalogMode('own'), 'own');
    assert.equal(parseCatalogMode('weird'), 'generic');
  });
});
