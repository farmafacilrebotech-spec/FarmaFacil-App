import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canAddKioskProductToCart,
  formatKioskProductAvailability,
  formatKioskProductPrice,
  isGenericCatalogProduct,
} from './catalog-display.ts';

describe('kiosk catalog display (generic vs own)', () => {
  it('no muestra 0 € ni trata genéricos como carrito', () => {
    const generic = {
      source: 'generic' as const,
      price: null,
      stock: null,
      available: false,
      availabilityStatus: 'confirm_with_pharmacy',
    };
    assert.equal(isGenericCatalogProduct(generic), true);
    assert.equal(canAddKioskProductToCart(generic), false);
    assert.match(formatKioskProductPrice(generic), /farmacia/i);
    assert.doesNotMatch(formatKioskProductPrice(generic), /0/);
    assert.match(formatKioskProductAvailability(generic), /Confirmar/i);
    assert.doesNotMatch(formatKioskProductAvailability(generic), /Sin stock/);
  });

  it('stock=0 en genérico no es «sin stock» comercial', () => {
    const weird = {
      source: 'generic' as const,
      price: 0,
      stock: 0,
      available: false,
      availabilityStatus: 'confirm_with_pharmacy' as const,
    };
    // source=generic → genérico aunque price/stock sean 0 en fila legacy
    assert.equal(isGenericCatalogProduct(weird), true);
    assert.equal(canAddKioskProductToCart(weird), false);
    assert.match(formatKioskProductPrice(weird), /Confirmar PVP/i);
  });

  it('propios con precio real sí van al carrito', () => {
    const own = {
      source: 'manual' as const,
      price: 12.5,
      stock: 3,
      available: true,
      availabilityStatus: 'available' as const,
    };
    assert.equal(isGenericCatalogProduct(own), false);
    assert.equal(canAddKioskProductToCart(own), true);
    assert.match(formatKioskProductPrice(own), /12/);
    assert.match(formatKioskProductAvailability(own), /Disponible/);
  });
});
