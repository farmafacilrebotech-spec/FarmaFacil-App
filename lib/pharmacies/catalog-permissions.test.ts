import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canManageCatalogProducts,
  catalogUiPermissions,
  filterProductPatchForCapability,
  isStockOnlyProductPatch,
} from './catalog-permissions.ts';

describe('catalog-permissions matrix helpers', () => {
  it('detects stock-only patches', () => {
    assert.equal(
      isStockOnlyProductPatch({ stock: 3, min_stock: 1, updated_by: 'x' }),
      true
    );
    assert.equal(
      isStockOnlyProductPatch({
        stock: 3,
        price: 9.5,
        updated_by: 'x',
      }),
      false
    );
  });

  it('STAFF/read cannot write', () => {
    const r = filterProductPatchForCapability({ stock: 1 }, 'read');
    assert.equal(r.ok, false);
  });

  it('PHARMACIST/stock updates stock and strips price (no write comercial)', () => {
    const ok = filterProductPatchForCapability(
      {
        stock: 4,
        availability_status: 'available',
        price: 99,
        name: 'Hack',
        updated_by: 'u',
      },
      'stock'
    );
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.patch.stock, 4);
      assert.equal(ok.patch.price, undefined);
      assert.equal(ok.patch.name, undefined);
    }

    const denied = filterProductPatchForCapability({ price: 12.5 }, 'stock');
    assert.equal(denied.ok, false);
  });

  it('OWNER/manage can update commercial fields', () => {
    const r = filterProductPatchForCapability(
      { price: 3.2, name: 'Test', stock: 1 },
      'manage'
    );
    assert.equal(r.ok, true);
    assert.equal(canManageCatalogProducts('manage'), true);
    assert.equal(canManageCatalogProducts('stock'), false);
  });

  it('UI permissions follow matrix', () => {
    assert.deepEqual(catalogUiPermissions('manage'), {
      canCreateOrImport: true,
      canEditCommercial: true,
      canEditStock: true,
      canToggleActive: true,
    });
    assert.deepEqual(catalogUiPermissions('stock'), {
      canCreateOrImport: false,
      canEditCommercial: false,
      canEditStock: true,
      canToggleActive: true,
    });
    assert.deepEqual(catalogUiPermissions('read'), {
      canCreateOrImport: false,
      canEditCommercial: false,
      canEditStock: false,
      canToggleActive: false,
    });
  });

  it('multifarmacia: helper is pharmacy-agnostic (isolation is authz+RLS)', () => {
    const a = filterProductPatchForCapability({ stock: 1 }, 'stock');
    const b = filterProductPatchForCapability({ price: 1 }, 'stock');
    assert.equal(a.ok, true);
    assert.equal(b.ok, false);
  });
});
