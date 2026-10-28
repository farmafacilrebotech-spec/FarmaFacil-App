import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  filterOrderStatusOptionsForPublicQr,
  isLegacyTotalOnlyPublicQr,
  publicQrMayEnterPreparing,
  validatePublicQrLineValuation,
} from './line-valuation.ts';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('validatePublicQrLineValuation', () => {
  it('dos productos disponibles con precios distintos', () => {
    const r = validatePublicQrLineValuation({
      existingLines: [
        { itemId: A, quantity: 1 },
        { itemId: B, quantity: 2 },
      ],
      submitted: [
        { itemId: A, availability: 'available', unitPrice: 5.5 },
        { itemId: B, availability: 'available', unitPrice: 3.25 },
      ],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.totalAmount, 12); // 5.50 + 2*3.25
    assert.equal(r.availableCount, 2);
    assert.equal(r.lines[1].lineTotal, 6.5);
  });

  it('producto no disponible no suma al total', () => {
    const r = validatePublicQrLineValuation({
      existingLines: [
        { itemId: A, quantity: 1 },
        { itemId: B, quantity: 1 },
      ],
      submitted: [
        { itemId: A, availability: 'available', unitPrice: 10 },
        { itemId: B, availability: 'unavailable', unitPrice: 99 },
      ],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.totalAmount, 10);
    assert.equal(r.lines[1].unitPrice, 0);
    assert.equal(r.availableCount, 1);
  });

  it('rechaza precio 0 en disponible (MVP)', () => {
    const r = validatePublicQrLineValuation({
      existingLines: [{ itemId: A, quantity: 1 }],
      submitted: [{ itemId: A, availability: 'available', unitPrice: 0 }],
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'zero_price_not_allowed');
  });

  it('rechaza precio pendiente / incompleto', () => {
    const r = validatePublicQrLineValuation({
      existingLines: [
        { itemId: A, quantity: 1 },
        { itemId: B, quantity: 1 },
      ],
      submitted: [{ itemId: A, availability: 'available', unitPrice: 4 }],
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'count_mismatch');
  });

  it('rechaza más de 2 decimales', () => {
    const r = validatePublicQrLineValuation({
      existingLines: [{ itemId: A, quantity: 1 }],
      submitted: [{ itemId: A, availability: 'available', unitPrice: 1.234 }],
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'invalid_amount');
  });

  it('redondeo de subtotal cantidad × precio', () => {
    const r = validatePublicQrLineValuation({
      existingLines: [{ itemId: A, quantity: 3 }],
      submitted: [{ itemId: A, availability: 'available', unitPrice: 1.11 }],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.totalAmount, 3.33);
  });
});

describe('publicQrMayEnterPreparing / legacy', () => {
  it('kiosko siempre ok', () => {
    assert.equal(
      publicQrMayEnterPreparing({
        source: 'kiosk',
        linesValuedAt: null,
        customerAcceptedAt: null,
        quoteLegacyTotalOnly: false,
      }).ok,
      true
    );
  });

  it('QR sin valorar → valuation_required', () => {
    const r = publicQrMayEnterPreparing({
      source: 'public_qr',
      linesValuedAt: null,
      customerAcceptedAt: null,
      quoteLegacyTotalOnly: false,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'valuation_required');
  });

  it('QR valorado sin aceptación → bloquea preparing', () => {
    const r = publicQrMayEnterPreparing({
      source: 'public_qr',
      linesValuedAt: '2026-10-26T00:00:00Z',
      customerAcceptedAt: null,
      quoteLegacyTotalOnly: false,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'quote_awaiting_customer_acceptance');
  });

  it('legacy sellado permite preparing; total 058 nuevo no', () => {
    assert.equal(
      publicQrMayEnterPreparing({
        source: 'public_qr',
        linesValuedAt: null,
        customerAcceptedAt: null,
        quoteLegacyTotalOnly: true,
      }).ok,
      true
    );
    assert.equal(
      publicQrMayEnterPreparing({
        source: 'public_qr',
        linesValuedAt: null,
        customerAcceptedAt: null,
        quoteLegacyTotalOnly: false,
      }).ok,
      false
    );
  });

  it('filtra preparing y ready en UI sin valoración', () => {
    const opts = filterOrderStatusOptionsForPublicQr({
      source: 'public_qr',
      status: 'request_pending',
      linesValuedAt: null,
      customerAcceptedAt: null,
      quoteLegacyTotalOnly: false,
      options: ['preparing', 'ready', 'cancelled'],
    });
    assert.deepEqual(opts, ['cancelled']);
  });

  it('valorado sin aceptación: no ofrecer preparing ni ready', () => {
    const opts = filterOrderStatusOptionsForPublicQr({
      source: 'public_qr',
      status: 'request_pending',
      linesValuedAt: '2026-10-26T00:00:00Z',
      customerAcceptedAt: null,
      quoteLegacyTotalOnly: false,
      options: ['preparing', 'cancelled'],
    });
    assert.deepEqual(opts, ['cancelled']);
  });

  it('preparing sin aceptación: no ofrecer ready (defensa)', () => {
    const opts = filterOrderStatusOptionsForPublicQr({
      source: 'public_qr',
      status: 'preparing',
      linesValuedAt: '2026-10-26T00:00:00Z',
      customerAcceptedAt: null,
      quoteLegacyTotalOnly: false,
      options: ['ready', 'cancelled'],
    });
    assert.deepEqual(opts, ['cancelled']);
  });

  it('histórico ready sin aceptación: no quita opciones de ready (ya está)', () => {
    const opts = filterOrderStatusOptionsForPublicQr({
      source: 'public_qr',
      status: 'ready',
      linesValuedAt: '2026-10-26T00:00:00Z',
      customerAcceptedAt: null,
      quoteLegacyTotalOnly: false,
      options: ['delivered', 'cancelled'],
    });
    assert.deepEqual(opts, ['delivered', 'cancelled']);
  });

  it('detecta histórico solo-total (#0009)', () => {
    assert.equal(
      isLegacyTotalOnlyPublicQr({
        source: 'public_qr',
        quoteLegacyTotalOnly: true,
        amountConfirmedAt: '2026-10-26T12:00:00Z',
        linesValuedAt: null,
        items: [
          { unitPrice: 0, availabilityStatus: 'pending' },
          { unitPrice: 0, availabilityStatus: 'pending' },
        ],
      }),
      true
    );
  });
});
