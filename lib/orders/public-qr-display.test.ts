/**
 * npm run test:orders (incluido vía labels / este archivo)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  filterPaymentOptionsForPublicQrAmount,
  formatPublicQrOrEuroAmount,
  isPublicQrAmountPending,
} from './public-qr-display.ts';
import { nextPaymentStatusOptions } from './transitions.ts';

describe('public_qr amount / payment UX', () => {
  it('no presenta 0 € como venta gratuita sin amount_confirmed_at', () => {
    assert.equal(
      formatPublicQrOrEuroAmount({
        amount: 0,
        source: 'public_qr',
        paymentStatus: 'pending_confirmation',
        orderStatus: 'request_pending',
        amountConfirmedAt: null,
        formatEuro: (n) => `${n}€`,
      }),
      'Precio y disponibilidad pendientes de confirmar'
    );
    assert.equal(
      isPublicQrAmountPending({
        amount: 0,
        source: 'public_qr',
        paymentStatus: 'pending_confirmation',
        orderStatus: 'request_pending',
        amountConfirmedAt: null,
      }),
      true
    );
  });

  it('0 € con amount_confirmed_at es importe confirmado (no pendiente)', () => {
    assert.equal(
      isPublicQrAmountPending({
        amount: 0,
        source: 'public_qr',
        paymentStatus: 'unpaid',
        orderStatus: 'ready',
        amountConfirmedAt: '2026-10-22T10:00:00.000Z',
      }),
      false
    );
    assert.equal(
      formatPublicQrOrEuroAmount({
        amount: 0,
        source: 'public_qr',
        paymentStatus: 'unpaid',
        amountConfirmedAt: '2026-10-22T10:00:00.000Z',
        formatEuro: (n, c) => `${n.toFixed(2)} ${c}`,
      }),
      '0.00 EUR'
    );
  });

  it('oculta Cobrado mientras el importe QR no está confirmado', () => {
    const opts = filterPaymentOptionsForPublicQrAmount(
      nextPaymentStatusOptions('pending_confirmation'),
      {
        amount: 0,
        source: 'public_qr',
        paymentStatus: 'pending_confirmation',
        orderStatus: 'request_pending',
        amountConfirmedAt: null,
      }
    );
    assert.deepEqual(opts.sort(), ['unpaid', 'waived']);
    assert.ok(!opts.includes('paid'));
  });

  it('permite Cobrado tras confirmar importe (unpaid → paid)', () => {
    const opts = filterPaymentOptionsForPublicQrAmount(
      nextPaymentStatusOptions('unpaid'),
      {
        amount: 12.5,
        source: 'public_qr',
        paymentStatus: 'unpaid',
        orderStatus: 'ready',
        amountConfirmedAt: '2026-10-22T10:00:00.000Z',
      }
    );
    assert.ok(opts.includes('paid'));
  });

  it('pedidos kiosko con unpaid siguen pudiendo marcar paid', () => {
    const opts = filterPaymentOptionsForPublicQrAmount(
      nextPaymentStatusOptions('unpaid'),
      {
        amount: 12.5,
        source: 'kiosk',
        paymentStatus: 'unpaid',
      }
    );
    assert.ok(opts.includes('paid'));
  });
});
