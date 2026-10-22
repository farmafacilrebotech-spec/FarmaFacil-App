import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  clearPublicQrCart,
  emptyPublicQrCart,
  filterPublicCatalogItemsByQuery,
  parsePublicQrCart,
  publicQrCartUnitCount,
  serializePublicQrCart,
  upsertPublicQrCartLine,
} from './public-catalog-cart-state.ts';

const PID = 'l595c6fdmhozxe2u';

describe('public QR cart persistence', () => {
  it('conserva líneas al filtrar (filtro no muta carrito)', () => {
    let cart = emptyPublicQrCart(PID);
    cart = upsertPublicQrCartLine(cart, {
      productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Producto A',
      delta: 1,
    });
    cart = upsertPublicQrCartLine(cart, {
      productId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Producto B bebé',
      delta: 1,
    });
    assert.equal(cart.lines.length, 2);
    assert.equal(publicQrCartUnitCount(cart), 2);

    const visible = filterPublicCatalogItemsByQuery(
      [
        {
          name: 'Producto A',
          category: 'Higiene',
          subcategory: null,
          sku: null,
        },
        {
          name: 'Producto B bebé',
          category: 'Bebé',
          subcategory: null,
          sku: null,
        },
      ],
      'bebé'
    );
    assert.equal(visible.length, 1);
    assert.equal(cart.lines.length, 2);
  });

  it('no restaura carrito de otro publicId', () => {
    const cart = upsertPublicQrCartLine(emptyPublicQrCart(PID), {
      productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'X',
      delta: 2,
    });
    const raw = serializePublicQrCart(cart);
    assert.equal(parsePublicQrCart(raw, 'other-public-id'), null);
    assert.equal(parsePublicQrCart(raw, PID)?.lines.length, 1);
  });

  it('clear vacía líneas tras envío', () => {
    let cart = upsertPublicQrCartLine(emptyPublicQrCart(PID), {
      productId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'X',
      delta: 1,
    });
    cart = clearPublicQrCart(cart);
    assert.equal(cart.lines.length, 0);
    assert.equal(cart.publicId, PID);
  });
});
