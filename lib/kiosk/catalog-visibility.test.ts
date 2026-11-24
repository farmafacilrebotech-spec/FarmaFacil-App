import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canAddKioskProductToCart } from './catalog-display.ts';
import { isPendingClassificationCategory } from '../catalog/taxonomy.ts';

/**
 * Reglas de publicación comercial (sin stock):
 * - activo + stock 0/null → visible/solicitabile
 * - archivado / pending → no comercial
 */
function isCommerciallyVisible(row: {
  isActive: boolean;
  category: string | null;
  availabilityStatus?: string | null;
}): boolean {
  if (!row.isActive) return false;
  if (isPendingClassificationCategory(row.category)) return false;
  if (row.availabilityStatus === 'unavailable') return false;
  return true;
}

describe('kiosk/client visibility (stock-independent)', () => {
  it('activo stock 0 / null publicable', () => {
    assert.equal(
      isCommerciallyVisible({
        isActive: true,
        category: 'Dermocosmética',
      }),
      true
    );
    assert.equal(
      canAddKioskProductToCart({
        source: 'import',
        price: 9.5,
        stock: 0,
        available: true,
        availabilityStatus: 'available',
      }),
      true
    );
    assert.equal(
      canAddKioskProductToCart({
        source: 'manual',
        price: 9.5,
        stock: null,
        available: true,
        availabilityStatus: 'available',
      }),
      true
    );
  });

  it('archivado / desactivado permanece oculto', () => {
    assert.equal(
      isCommerciallyVisible({
        isActive: false,
        category: 'Dermocosmética',
      }),
      false
    );
  });

  it('pendiente de clasificar no se publica', () => {
    assert.equal(
      isCommerciallyVisible({
        isActive: true,
        category: 'Pendiente de clasificar',
      }),
      false
    );
  });

  it('invalid/unavailable no va al carrito', () => {
    assert.equal(
      canAddKioskProductToCart({
        source: 'manual',
        price: null,
        stock: 5,
        available: true,
        availabilityStatus: 'available',
      }),
      false
    );
    assert.equal(
      canAddKioskProductToCart({
        source: 'manual',
        price: 5,
        stock: 5,
        available: true,
        availabilityStatus: 'unavailable',
      }),
      false
    );
  });
});
