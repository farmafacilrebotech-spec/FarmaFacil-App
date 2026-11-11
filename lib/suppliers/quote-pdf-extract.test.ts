import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  compareMoneyField,
  compareTaxIdField,
  compareTextField,
  detectIdentityMismatch,
  emptyQuotePdfExtract,
  normalizeMoneyCents,
  normalizeTaxId,
  normalizeText,
  parseExtractJson,
} from './quote-pdf-extract.ts';

describe('quote-pdf-extract normalize', () => {
  it('normaliza textos e ignora acentos/espacios', () => {
    assert.equal(normalizeText('  Farma  Fácil '), 'farma facil');
  });

  it('normaliza CIF', () => {
    assert.equal(normalizeTaxId('b-12345678'), 'B12345678');
  });

  it('normaliza importes euros/céntimos', () => {
    assert.equal(normalizeMoneyCents('12,50'), 1250);
    assert.equal(normalizeMoneyCents('1.234,56'), 123456);
    assert.equal(normalizeMoneyCents(1250), 1250);
  });
});

describe('quote-pdf-extract compare', () => {
  it('marca missing_in_pdf sin tratarlo como discrepancia', () => {
    const d = compareTextField('title', 'Pack', null);
    assert.equal(d.kind, 'missing_in_pdf');
  });

  it('detecta solo formato en textos equivalentes', () => {
    const d = compareTextField('title', 'Pack Promo', 'pack   promo');
    assert.equal(d.kind, 'format_only');
  });

  it('detecta diferencia real de importe', () => {
    const d = compareMoneyField('shipping', 800, 4500);
    assert.equal(d.kind, 'real_diff');
  });

  it('CIF con formato distinto no es real_diff', () => {
    const d = compareTaxIdField('tax', 'B-12345678', 'B12345678');
    assert.equal(d.kind, 'format_only');
  });
});

describe('quote-pdf-extract identity', () => {
  it('bloquea si CIF o número difieren', () => {
    const extract = {
      ...emptyQuotePdfExtract(),
      supplierTaxId: 'A99999999',
      quoteNumber: 'P-2',
    };
    const r = detectIdentityMismatch({
      currentSupplierTaxId: 'B11111111',
      currentQuoteNumber: 'P-1',
      extract,
    });
    assert.equal(r.mismatch, true);
    assert.ok(r.messages.length >= 1);
  });
});

describe('parseExtractJson', () => {
  it('parsea JSON envuelto en texto', () => {
    const raw =
      'Aquí va:\n{"supplierName":"Alpha","quoteNumber":"Q1","lines":[{"description":"Bolsa","quantity":10,"unitPrice":"1,25"}],"warnings":[]}';
    const parsed = parseExtractJson(raw);
    assert.equal(parsed.supplierName, 'Alpha');
    assert.equal(parsed.quoteNumber, 'Q1');
    assert.equal(parsed.lines[0]?.unitPriceCents, 125);
    assert.equal(parsed.lines[0]?.quantity, 10);
  });
});
