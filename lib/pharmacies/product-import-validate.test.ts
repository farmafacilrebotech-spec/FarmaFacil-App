/**
 * npm run test:product-import
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isBlankCell,
  isBlankProductDraft,
  isInvalidProductName,
  isJunkStructuralRow,
  looksLikeEan13,
  looksLikeNationalCode,
  normalizeIdentifier,
} from './product-import-validate.ts';

type Draft = {
  rowIndex: number;
  sku: string | null;
  ean: string | null;
  nationalCode: string | null;
  name: string;
  brand: string | null;
  laboratory: string | null;
  category: string | null;
  sourceFamily: string | null;
  sourceSubfamily: string | null;
  description: string | null;
  price: number | null;
  stock: number | null;
  minStock: number | null;
  priceProvided: boolean;
  stockProvided: boolean;
  minStockProvided: boolean;
};

function draft(partial: Partial<Draft>): Draft {
  return {
    rowIndex: 2,
    sku: null,
    ean: null,
    nationalCode: null,
    name: '',
    brand: null,
    laboratory: null,
    category: null,
    sourceFamily: null,
    sourceSubfamily: null,
    description: null,
    price: null,
    stock: null,
    minStock: null,
    priceProvided: false,
    stockProvided: false,
    minStockProvided: false,
    ...partial,
  };
}

describe('product-import-validate', () => {
  it('trata 0 / espacios como celdas vacías de texto', () => {
    assert.equal(isBlankCell('0'), true);
    assert.equal(isBlankCell('  '), true);
    assert.equal(isBlankCell('AVENE'), false);
  });

  it('no confunde precio cero informado con vacío', () => {
    const zeroPrice = draft({
      name: 'Producto real',
      price: 0,
      priceProvided: true,
    });
    assert.equal(isBlankProductDraft(zeroPrice), false);
    assert.equal(isInvalidProductName(zeroPrice.name), false);
  });

  it('marca name=0 sin contenido como inválido / vacío', () => {
    assert.equal(isInvalidProductName('0'), true);
    assert.equal(isBlankProductDraft(draft({ name: '0', brand: '0' })), true);
  });

  it('detecta CN vs EAN y preserva ceros en identificadores', () => {
    assert.equal(looksLikeNationalCode('1503268'), true);
    assert.equal(looksLikeEan13('8470001234567'), true);
    assert.equal(normalizeIdentifier('00123'), '00123');
    assert.equal(normalizeIdentifier('0'), null);
  });

  it('detecta cabeceras repetidas y subtotales', () => {
    assert.equal(isJunkStructuralRow(draft({ name: 'Producto' })), true);
    assert.equal(isJunkStructuralRow(draft({ name: 'Total familia' })), true);
    assert.equal(
      isJunkStructuralRow(draft({ name: 'AVENE SPRAY 30', ean: '1512550' })),
      false
    );
  });
});
