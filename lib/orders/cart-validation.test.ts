/**
 * npm run test:orders
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolveCartForPharmacy,
  type CatalogProductForOrder,
} from './cart-validation.ts';

const PHARMACY_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PHARMACY_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PRODUCT_1 = '11111111-1111-4111-8111-111111111111';
const PRODUCT_2 = '22222222-2222-4222-8222-222222222222';
const PRODUCT_3 = '33333333-3333-4333-8333-333333333333';

function product(
  overrides: Partial<CatalogProductForOrder> & Pick<CatalogProductForOrder, 'id'>
): CatalogProductForOrder {
  return {
    pharmacyId: PHARMACY_A,
    name: 'Producto test',
    price: 10,
    isActive: true,
    ...overrides,
  };
}

function catalog(
  products: CatalogProductForOrder[]
): Map<string, CatalogProductForOrder> {
  return new Map(products.map((p) => [p.id, p]));
}

describe('resolveCartForPharmacy — pedido válido', () => {
  it('resuelve líneas y total con precios de catálogo', () => {
    const result = resolveCartForPharmacy({
      sessionPharmacyId: PHARMACY_A,
      productsById: catalog([
        product({ id: PRODUCT_1, name: 'Crema', price: 5.5 }),
        product({ id: PRODUCT_2, name: 'Gel', price: 3 }),
      ]),
      lines: [
        { productId: PRODUCT_1, quantity: 2 },
        { productId: PRODUCT_2, quantity: 1 },
      ],
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.lines.length, 2);
    assert.equal(result.lines[0]!.unitPrice, 5.5);
    assert.equal(result.lines[0]!.lineTotal, 11);
    assert.equal(result.lines[0]!.productName, 'Crema');
    assert.equal(result.totalAmount, 14);
  });
});

describe('resolveCartForPharmacy — producto inactivo', () => {
  it('rechaza productos is_active=false', () => {
    const result = resolveCartForPharmacy({
      sessionPharmacyId: PHARMACY_A,
      productsById: catalog([
        product({ id: PRODUCT_1, isActive: false, name: 'Archivado' }),
      ]),
      lines: [{ productId: PRODUCT_1, quantity: 1 }],
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'product_inactive');
    assert.equal(result.productId, PRODUCT_1);
  });
});

describe('resolveCartForPharmacy — cantidad incorrecta', () => {
  it('rechaza cantidad 0, negativa o >99', () => {
    const products = catalog([product({ id: PRODUCT_1 })]);
    for (const quantity of [0, -1, 1.5, 100, NaN]) {
      const result = resolveCartForPharmacy({
        sessionPharmacyId: PHARMACY_A,
        productsById: products,
        lines: [{ productId: PRODUCT_1, quantity }],
      });
      assert.equal(result.ok, false, `qty=${quantity}`);
      if (!result.ok) assert.equal(result.code, 'invalid_quantity');
    }
  });
});

describe('resolveCartForPharmacy — precio manipulado', () => {
  it('rechaza si clientUnitPrice ≠ precio de catálogo', () => {
    const result = resolveCartForPharmacy({
      sessionPharmacyId: PHARMACY_A,
      productsById: catalog([product({ id: PRODUCT_1, price: 10 })]),
      lines: [
        { productId: PRODUCT_1, quantity: 1, clientUnitPrice: 0.01 },
      ],
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'price_mismatch');
  });

  it('acepta si clientUnitPrice coincide (se usa precio servidor)', () => {
    const result = resolveCartForPharmacy({
      sessionPharmacyId: PHARMACY_A,
      productsById: catalog([product({ id: PRODUCT_1, price: 10 })]),
      lines: [
        { productId: PRODUCT_1, quantity: 2, clientUnitPrice: 10 },
      ],
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.lines[0]!.unitPrice, 10);
    assert.equal(result.totalAmount, 20);
  });
});

describe('resolveCartForPharmacy — farmacia diferente', () => {
  it('rechaza producto de otra farmacia aunque exista en catálogo global', () => {
    const result = resolveCartForPharmacy({
      sessionPharmacyId: PHARMACY_A,
      productsById: catalog([
        product({
          id: PRODUCT_3,
          pharmacyId: PHARMACY_B,
          name: 'De otra farmacia',
        }),
      ]),
      lines: [{ productId: PRODUCT_3, quantity: 1 }],
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'product_wrong_pharmacy');
  });
});

describe('resolveCartForPharmacy — carrito vacío / duplicados', () => {
  it('rechaza carrito vacío', () => {
    const result = resolveCartForPharmacy({
      sessionPharmacyId: PHARMACY_A,
      productsById: catalog([]),
      lines: [],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'empty_cart');
  });

  it('rechaza el mismo productId dos veces', () => {
    const result = resolveCartForPharmacy({
      sessionPharmacyId: PHARMACY_A,
      productsById: catalog([product({ id: PRODUCT_1 })]),
      lines: [
        { productId: PRODUCT_1, quantity: 1 },
        { productId: PRODUCT_1, quantity: 2 },
      ],
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'duplicate_product_in_cart');
  });
});
