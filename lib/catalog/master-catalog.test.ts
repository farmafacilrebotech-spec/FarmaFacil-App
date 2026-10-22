import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MASTER_CATALOG_EXPECTED_COUNT,
  getValidatedMasterRows,
  isMasterCatalogId,
  masterSourceRef,
  productVisibleInActiveCatalog,
  validateMasterCatalogLocal,
} from './master-catalog.ts';

describe('master catalog Excel validation artifact', () => {
  it('tiene exactamente 100 FF-GEN únicos sin marca/precio/imagen', () => {
    const result = validateMasterCatalogLocal();
    assert.equal(result.ok, true, result.errors.join('; '));
    assert.equal(result.count, MASTER_CATALOG_EXPECTED_COUNT);
    assert.equal(result.categories, 8);
    assert.ok(result.subcategories >= 30);
  });

  it('source_ref estable y visibilidad por modalidad', () => {
    assert.equal(masterSourceRef('FF-GEN-001'), 'ff_master_v1:FF-GEN-001');
    assert.equal(isMasterCatalogId('FF-GEN-100'), true);
    assert.equal(isMasterCatalogId('DEMO-001'), false);

    assert.equal(productVisibleInActiveCatalog('generic', 'generic'), true);
    assert.equal(productVisibleInActiveCatalog('manual', 'generic'), false);
    assert.equal(productVisibleInActiveCatalog('import', 'own'), true);
    assert.equal(productVisibleInActiveCatalog('generic', 'own'), false);
  });

  it('todas las filas available_in_plans=pilot,general', () => {
    const rows = getValidatedMasterRows();
    assert.equal(rows.length, 100);
    for (const r of rows) {
      assert.equal(r.available_in_plans, 'pilot,general');
      assert.equal(r.record_type, 'generic_request_type');
    }
  });
});
