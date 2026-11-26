import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  KIOSK_CLIENT_AVAILABILITY,
  canAddKioskProductToCart,
  formatKioskProductAvailability,
  formatKioskProductAvailabilityHint,
  formatKioskProductPrice,
  isGenericCatalogProduct,
} from './catalog-display.ts';

describe('kiosk catalog display (stock no bloqueante)', () => {
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
    assert.match(formatKioskProductPrice(generic), /Consultar precio/i);
    assert.doesNotMatch(formatKioskProductPrice(generic), /0,00/);
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
    assert.equal(isGenericCatalogProduct(weird), true);
    assert.equal(canAddKioskProductToCart(weird), false);
    assert.match(formatKioskProductPrice(weird), /Consultar precio/i);
  });

  it('propio con precio 0 es solicitabile y muestra Consultar precio', () => {
    const own = {
      source: 'manual' as const,
      price: 0,
      stock: 5,
      available: true,
      availabilityStatus: 'available' as const,
    };
    assert.equal(canAddKioskProductToCart(own), true);
    assert.match(formatKioskProductPrice(own), /Consultar precio/i);
    assert.doesNotMatch(formatKioskProductPrice(own), /0,00/);
  });

  it('propio activo con stock 0 es solicitabile y sin cantidad al cliente', () => {
    const own = {
      source: 'manual' as const,
      price: 12.5,
      stock: 0,
      available: true,
      availabilityStatus: 'available' as const,
    };
    assert.equal(isGenericCatalogProduct(own), false);
    assert.equal(canAddKioskProductToCart(own), true);
    assert.equal(
      formatKioskProductAvailability(own),
      KIOSK_CLIENT_AVAILABILITY.requestable
    );
    assert.doesNotMatch(formatKioskProductAvailability(own), /\d/);
    assert.doesNotMatch(formatKioskProductAvailability(own), /Sin stock|Agotado/i);
    assert.equal(
      formatKioskProductAvailabilityHint(own),
      KIOSK_CLIENT_AVAILABILITY.pharmacyWillConfirm
    );
  });

  it('propio activo con stock NULL es solicitabile', () => {
    const own = {
      source: 'import' as const,
      price: 8,
      stock: null,
      available: true,
      availabilityStatus: 'available' as const,
    };
    assert.equal(canAddKioskProductToCart(own), true);
    assert.equal(
      formatKioskProductAvailability(own),
      KIOSK_CLIENT_AVAILABILITY.requestable
    );
  });

  it('unavailable sigue bloqueando el carrito', () => {
    const own = {
      source: 'manual' as const,
      price: 5,
      stock: 10,
      available: false,
      availabilityStatus: 'unavailable' as const,
    };
    assert.equal(canAddKioskProductToCart(own), false);
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
    assert.match(formatKioskProductAvailability(own), /Disponible para solicitar/);
  });
});
