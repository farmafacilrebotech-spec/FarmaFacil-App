import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PRICE_COPY,
  classifyCatalogPrice,
  formatCatalogPriceLabel,
  formatLinePriceLabel,
  isPriceInformed,
  isPricePending,
} from './price-display.ts';

describe('catalog price display', () => {
  it('trata 0 y null como pendientes, no como gratis', () => {
    assert.equal(classifyCatalogPrice(0), 'pending');
    assert.equal(classifyCatalogPrice(null), 'pending');
    assert.equal(classifyCatalogPrice(undefined), 'pending');
    assert.equal(isPricePending(0), true);
    assert.equal(isPriceInformed(0), false);
    assert.equal(formatCatalogPriceLabel(0), PRICE_COPY.consultPrice);
    assert.equal(formatLinePriceLabel(0), PRICE_COPY.pendingValuation);
  });

  it('precios > 0 son informados', () => {
    assert.equal(classifyCatalogPrice(12.5), 'informed');
    assert.match(formatCatalogPriceLabel(12.5), /12/);
    assert.doesNotMatch(formatCatalogPriceLabel(12.5), /0,00/);
  });

  it('genéricos siempre consultan precio', () => {
    assert.equal(
      formatCatalogPriceLabel(99, { generic: true }),
      PRICE_COPY.consultPrice
    );
  });
});
