import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CUSTOMER_AMOUNT_PENDING_LABEL,
  CUSTOMER_REQUEST_PENDING_LABEL,
  customerOrderListPresentation,
  customerOrderStatusLabel,
  formatCustomerOrderAmount,
  isCustomerOrderAmountPending,
} from './order-display.ts';

const ALL_STATUSES = [
  'pending_payment',
  'request_pending',
  'preparing',
  'ready',
  'delivered',
  'cancelled',
] as const;

describe('customer order status labels', () => {
  it('request_pending → Pendiente de confirmar (no snake_case)', () => {
    assert.equal(
      customerOrderStatusLabel('request_pending'),
      CUSTOMER_REQUEST_PENDING_LABEL
    );
    assert.ok(!customerOrderStatusLabel('request_pending').includes('_'));
  });

  it('reutiliza etiquetas del panel para el resto de estados', () => {
    assert.equal(customerOrderStatusLabel('preparing'), 'En preparación');
    assert.equal(customerOrderStatusLabel('ready'), 'Listo para recoger');
    assert.equal(customerOrderStatusLabel('delivered'), 'Entregado');
    assert.equal(customerOrderStatusLabel('cancelled'), 'Cancelado');
    assert.equal(customerOrderStatusLabel('pending_payment'), 'Pago pendiente');
  });

  it('cubre todos los OrderStatus sin valores técnicos', () => {
    for (const status of ALL_STATUSES) {
      const label = customerOrderStatusLabel(status);
      assert.ok(label.length > 0);
      assert.ok(!label.includes('_'), status);
      assert.notEqual(label.toLowerCase(), status);
    }
  });

  it('estado desconocido no expone el raw', () => {
    assert.equal(customerOrderStatusLabel('foo_bar'), 'Estado desconocido');
  });
});

describe('customer order amount presentation', () => {
  it('QR con total numérico pero sin amount_confirmed_at → pendiente', () => {
    const input = {
      amount: 9.95,
      currency: 'EUR',
      source: 'public_qr',
      paymentStatus: 'pending_confirmation',
      orderStatus: 'request_pending',
      amountConfirmedAt: null as string | null,
    };
    assert.equal(isCustomerOrderAmountPending(input), true);
    assert.equal(formatCustomerOrderAmount(input), CUSTOMER_AMOUNT_PENDING_LABEL);
  });

  it('QR con amount_confirmed_at muestra importe en es-ES', () => {
    const label = formatCustomerOrderAmount({
      amount: 9.95,
      currency: 'EUR',
      source: 'public_qr',
      paymentStatus: 'unpaid',
      orderStatus: 'preparing',
      amountConfirmedAt: '2026-11-03T10:00:00.000Z',
    });
    assert.match(label, /9[,.]95/);
    assert.ok(label.includes('€') || label.includes('EUR'));
    assert.notEqual(label, CUSTOMER_AMOUNT_PENDING_LABEL);
  });

  it('0 € confirmado no es pendiente', () => {
    assert.equal(
      isCustomerOrderAmountPending({
        amount: 0,
        source: 'public_qr',
        amountConfirmedAt: '2026-11-03T10:00:00.000Z',
      }),
      false
    );
  });

  it('list presentation combina estado e importe (#0011)', () => {
    const view = customerOrderListPresentation({
      status: 'request_pending',
      totalAmount: 9.95,
      currency: 'EUR',
      source: 'public_qr',
      paymentStatus: 'pending_confirmation',
      amountConfirmedAt: null,
    });
    assert.equal(view.statusLabel, CUSTOMER_REQUEST_PENDING_LABEL);
    assert.equal(view.amountLabel, CUSTOMER_AMOUNT_PENDING_LABEL);
  });
});
