import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  KIOSK_CART_IDLE_MS,
  addOrUpdateCartLine,
  bindCartToPharmacy,
  cartDisplayTotal,
  cartLineCount,
  clearCart,
  emptyKioskCart,
  isCartIdle,
  parseStoredCart,
  removeCartLine,
  setCartLineQuantity,
} from './cart-state.ts';

const PHARMACY_A = '11111111-1111-4111-8111-111111111111';
const PHARMACY_B = '22222222-2222-4222-8222-222222222222';
const PRODUCT_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRODUCT_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('kiosk cart — add / qty / remove / total', () => {
  it('añade líneas y calcula total con precios de catálogo (UI)', () => {
    let cart = emptyKioskCart(PHARMACY_A);
    cart = addOrUpdateCartLine(cart, {
      productId: PRODUCT_1,
      name: 'Vitamina C',
      brand: 'Farm',
      unitPrice: 5.5,
      stock: 10,
    });
    cart = addOrUpdateCartLine(cart, {
      productId: PRODUCT_1,
      name: 'Vitamina C',
      brand: 'Farm',
      unitPrice: 5.5,
      stock: 10,
    });
    cart = addOrUpdateCartLine(cart, {
      productId: PRODUCT_2,
      name: 'Gel',
      brand: null,
      unitPrice: 3,
      stock: 5,
    });
    assert.equal(cart.lines.length, 2);
    assert.equal(cart.lines[0]?.quantity, 2);
    assert.equal(cartDisplayTotal(cart), 14);
  });

  it('respeta stock y elimina al llegar a 0', () => {
    let cart = emptyKioskCart(PHARMACY_A);
    cart = addOrUpdateCartLine(cart, {
      productId: PRODUCT_1,
      name: 'X',
      brand: null,
      unitPrice: 1,
      stock: 2,
      quantityDelta: 5,
    });
    assert.equal(cart.lines[0]?.quantity, 2);
    cart = setCartLineQuantity(cart, PRODUCT_1, 0);
    assert.equal(cart.lines.length, 0);
    cart = addOrUpdateCartLine(cart, {
      productId: PRODUCT_1,
      name: 'X',
      brand: null,
      unitPrice: 1,
      stock: 0,
    });
    assert.equal(cart.lines.length, 0);
  });

  it('removeCartLine y clearCart', () => {
    let cart = emptyKioskCart(PHARMACY_A);
    cart = addOrUpdateCartLine(cart, {
      productId: PRODUCT_1,
      name: 'A',
      brand: null,
      unitPrice: 2,
      stock: 3,
    });
    cart = removeCartLine(cart, PRODUCT_1);
    assert.equal(cart.lines.length, 0);
    cart = addOrUpdateCartLine(cart, {
      productId: PRODUCT_2,
      name: 'B',
      brand: null,
      unitPrice: 1,
      stock: 1,
    });
    cart = clearCart(cart);
    assert.equal(cart.lines.length, 0);
    assert.equal(cart.pharmacyId, PHARMACY_A);
  });
});

describe('kiosk cart — aislamiento farmacia e idle', () => {
  it('vacía el carrito si cambia la farmacia de la sesión', () => {
    let cart = emptyKioskCart(PHARMACY_A);
    cart = addOrUpdateCartLine(cart, {
      productId: PRODUCT_1,
      name: 'A',
      brand: null,
      unitPrice: 1,
      stock: 5,
    });
    cart = bindCartToPharmacy(cart, PHARMACY_B);
    assert.equal(cart.pharmacyId, PHARMACY_B);
    assert.equal(cart.lines.length, 0);
  });

  it('detecta inactividad sin tocar la sesión de dispositivo', () => {
    const cart = {
      pharmacyId: PHARMACY_A,
      lines: [
        {
          productId: PRODUCT_1,
          name: 'A',
          brand: null,
          unitPrice: 1,
          quantity: 1,
          stock: 5,
        },
      ],
      updatedAt: Date.now() - KIOSK_CART_IDLE_MS - 1,
    };
    assert.equal(isCartIdle(cart, Date.now()), true);
    assert.equal(isCartIdle(cart, cart.updatedAt + 1000), false);
  });

  it('parseStoredCart ignora payload corrupto', () => {
    assert.equal(parseStoredCart('not-json'), null);
    const empty = parseStoredCart('{"lines":[]}');
    assert.ok(empty);
    assert.equal(empty!.lines.length, 0);
    const parsed = parseStoredCart(
      JSON.stringify({
        pharmacyId: PHARMACY_A,
        updatedAt: 1,
        lines: [{ productId: PRODUCT_1, name: 'A', unitPrice: 2, quantity: 1, stock: 3 }],
      })
    );
    assert.ok(parsed);
    assert.equal(parsed!.lines[0]?.productId, PRODUCT_1);
  });
});

/**
 * Simula la UI del catálogo dispositivo (Añadir / + / − → qty 0)
 * contra el mismo estado que usa kiosk-cart-provider (sin segundo carrito).
 */
describe('kiosk cart — selección visual catálogo (sync)', () => {
  function qtyOf(
    cart: ReturnType<typeof emptyKioskCart>,
    productId: string
  ): number {
    return cart.lines.find((l) => l.productId === productId)?.quantity ?? 0;
  }

  it('añade, incrementa, reduce, elimina y respeta stock', () => {
    let cart = emptyKioskCart(PHARMACY_A);
    const base = {
      productId: PRODUCT_1,
      name: 'Protector solar spray',
      brand: 'Farm',
      unitPrice: 8.7,
      stock: 3,
    };

    // Añadir
    cart = addOrUpdateCartLine(cart, { ...base, quantityDelta: 1 });
    assert.equal(qtyOf(cart, PRODUCT_1), 1);
    assert.equal(cartLineCount(cart), 1);

    // Incrementar (+)
    cart = addOrUpdateCartLine(cart, { ...base, quantityDelta: 1 });
    assert.equal(qtyOf(cart, PRODUCT_1), 2);
    assert.equal(cartLineCount(cart), 2);

    // Límite de stock
    cart = addOrUpdateCartLine(cart, { ...base, quantityDelta: 5 });
    assert.equal(qtyOf(cart, PRODUCT_1), 3);
    assert.equal(cartLineCount(cart), 3);

    // Reducir (−)
    cart = setCartLineQuantity(cart, PRODUCT_1, qtyOf(cart, PRODUCT_1) - 1);
    assert.equal(qtyOf(cart, PRODUCT_1), 2);

    // Eliminar (qty → 0 recupera estado inicial en UI)
    cart = setCartLineQuantity(cart, PRODUCT_1, 0);
    assert.equal(qtyOf(cart, PRODUCT_1), 0);
    assert.equal(cart.lines.length, 0);
    assert.equal(cartLineCount(cart), 0);

    // removeCartLine también vacía
    cart = addOrUpdateCartLine(cart, { ...base, quantityDelta: 1 });
    cart = removeCartLine(cart, PRODUCT_1);
    assert.equal(qtyOf(cart, PRODUCT_1), 0);
  });

  it('sincroniza contador del carrito con varias líneas', () => {
    let cart = emptyKioskCart(PHARMACY_A);
    cart = addOrUpdateCartLine(cart, {
      productId: PRODUCT_1,
      name: 'A',
      brand: null,
      unitPrice: 1,
      stock: 5,
      quantityDelta: 2,
    });
    cart = addOrUpdateCartLine(cart, {
      productId: PRODUCT_2,
      name: 'B',
      brand: null,
      unitPrice: 2,
      stock: 5,
      quantityDelta: 1,
    });
    assert.equal(cartLineCount(cart), 3);
    cart = setCartLineQuantity(cart, PRODUCT_1, 1);
    assert.equal(cartLineCount(cart), 2);
  });
});
