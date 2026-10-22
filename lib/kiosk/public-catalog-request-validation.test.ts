import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isZeroTotalAllowedForPublicRequest,
  normalizeSpanishPhone,
  shouldShowPublicCatalogPrice,
  validatePublicCatalogRequestInput,
  validatePublicRequestLines,
} from './public-catalog-request-validation.ts';

const PID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const PID2 = 'aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff';

describe('normalizeSpanishPhone', () => {
  it('acepta 9 dígitos nacionales', () => {
    assert.equal(normalizeSpanishPhone('612345678'), '612345678');
    assert.equal(normalizeSpanishPhone('712 34 56 78'), '712345678');
  });

  it('acepta +34 / 0034', () => {
    assert.equal(normalizeSpanishPhone('+34 612 345 678'), '612345678');
    assert.equal(normalizeSpanishPhone('0034612345678'), '612345678');
  });

  it('rechaza inválidos', () => {
    assert.equal(normalizeSpanishPhone('512345678'), null);
    assert.equal(normalizeSpanishPhone('61234567'), null);
    assert.equal(normalizeSpanishPhone(''), null);
  });
});

describe('validatePublicRequestLines', () => {
  it('acepta uno o varios productos', () => {
    const one = validatePublicRequestLines([{ productId: PID, quantity: 1 }]);
    assert.equal(one.ok, true);
    const many = validatePublicRequestLines([
      { productId: PID, quantity: 2 },
      { productId: PID2, quantity: 3 },
    ]);
    assert.equal(many.ok, true);
  });

  it('rechaza cantidades incorrectas', () => {
    assert.equal(
      validatePublicRequestLines([{ productId: PID, quantity: 0 }]).ok,
      false
    );
    assert.equal(
      validatePublicRequestLines([{ productId: PID, quantity: 21 }]).ok,
      false
    );
    assert.equal(
      validatePublicRequestLines([{ productId: PID, quantity: 1.5 }]).ok,
      false
    );
  });

  it('rechaza duplicados y vacío', () => {
    assert.equal(validatePublicRequestLines([]).ok, false);
    assert.equal(
      validatePublicRequestLines([
        { productId: PID, quantity: 1 },
        { productId: PID, quantity: 2 },
      ]).ok,
      false
    );
  });

  it('rechaza productId no UUID', () => {
    assert.equal(
      validatePublicRequestLines([{ productId: 'no-uuid', quantity: 1 }]).ok,
      false
    );
  });
});

describe('validatePublicCatalogRequestInput', () => {
  const base = {
    publicId: 'uy1n0h5eafuvdtzi',
    clientRequestId: 'req-test-001',
    lines: [{ productId: PID, quantity: 1 }],
    contact: {
      customerName: 'Ana López',
      customerPhone: '612345678',
      privacyAccepted: true,
    },
  };

  it('acepta payload válido sin pharmacy_id', () => {
    const result = validatePublicCatalogRequestInput(base);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.customerPhone, '612345678');
      assert.equal(result.publicId, 'uy1n0h5eafuvdtzi');
    }
  });

  it('exige privacidad', () => {
    const result = validatePublicCatalogRequestInput({
      ...base,
      contact: { ...base.contact, privacyAccepted: false },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'privacy_required');
  });

  it('rechaza teléfono inválido', () => {
    const result = validatePublicCatalogRequestInput({
      ...base,
      contact: { ...base.contact, customerPhone: '123' },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'invalid_customer_phone');
  });

  it('rechaza publicId inválido', () => {
    const result = validatePublicCatalogRequestInput({
      ...base,
      publicId: 'AB',
    });
    assert.equal(result.ok, false);
  });
});

describe('política precios públicos', () => {
  it('genérico no muestra precio inventado y permite total 0', () => {
    assert.equal(shouldShowPublicCatalogPrice('generic'), false);
    assert.equal(isZeroTotalAllowedForPublicRequest('generic'), true);
  });

  it('propio puede mostrar precio de catálogo (no inventado)', () => {
    assert.equal(shouldShowPublicCatalogPrice('own'), true);
    assert.equal(isZeroTotalAllowedForPublicRequest('own'), false);
  });
});
