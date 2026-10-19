/**
 * npm run test:orders
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertOrderStatusTransition,
  assertPaymentStatusTransition,
  isOrderStatusTransitionAllowed,
  isPaymentStatusTransitionAllowed,
} from './transitions.ts';
import type { OrderStatus, PaymentStatus } from './types.ts';

describe('order status transitions', () => {
  it('allows pending_payment → preparing | cancelled', () => {
    assert.equal(
      isOrderStatusTransitionAllowed('pending_payment', 'preparing'),
      true
    );
    assert.equal(
      isOrderStatusTransitionAllowed('pending_payment', 'cancelled'),
      true
    );
  });

  it('allows preparing → ready | cancelled and ready → delivered', () => {
    assert.equal(isOrderStatusTransitionAllowed('preparing', 'ready'), true);
    assert.equal(
      isOrderStatusTransitionAllowed('preparing', 'cancelled'),
      true
    );
    assert.equal(isOrderStatusTransitionAllowed('ready', 'delivered'), true);
  });

  it('rejects invalid operational transitions', () => {
    const invalid: Array<[OrderStatus, OrderStatus]> = [
      ['pending_payment', 'ready'],
      ['pending_payment', 'delivered'],
      ['preparing', 'pending_payment'],
      ['preparing', 'delivered'],
      ['ready', 'preparing'],
      ['delivered', 'ready'],
      ['delivered', 'cancelled'],
      ['cancelled', 'preparing'],
      ['cancelled', 'pending_payment'],
    ];
    for (const [from, to] of invalid) {
      assert.equal(
        isOrderStatusTransitionAllowed(from, to),
        false,
        `${from} → ${to}`
      );
      assert.equal(assertOrderStatusTransition(from, to).ok, false);
    }
  });

  it('allows no-op same status', () => {
    assert.equal(
      isOrderStatusTransitionAllowed('preparing', 'preparing'),
      true
    );
  });
});

describe('payment status transitions', () => {
  it('allows unpaid → paid | waived and paid → refunded', () => {
    assert.equal(isPaymentStatusTransitionAllowed('unpaid', 'paid'), true);
    assert.equal(isPaymentStatusTransitionAllowed('unpaid', 'waived'), true);
    assert.equal(isPaymentStatusTransitionAllowed('paid', 'refunded'), true);
  });

  it('rejects invalid payment transitions', () => {
    const invalid: Array<[PaymentStatus, PaymentStatus]> = [
      ['unpaid', 'refunded'],
      ['paid', 'unpaid'],
      ['refunded', 'paid'],
      ['waived', 'unpaid'],
      ['waived', 'refunded'],
    ];
    for (const [from, to] of invalid) {
      assert.equal(
        isPaymentStatusTransitionAllowed(from, to),
        false,
        `${from} → ${to}`
      );
      assert.equal(assertPaymentStatusTransition(from, to).ok, false);
    }
  });

  it('keeps payment status independent from order status', () => {
    // Un pedido puede estar "preparing" y aún unpaid, o ready y paid.
    // Las matrices no se cruzan: solo se valida cada eje por separado.
    assert.equal(isOrderStatusTransitionAllowed('preparing', 'ready'), true);
    assert.equal(isPaymentStatusTransitionAllowed('unpaid', 'paid'), true);
  });
});
