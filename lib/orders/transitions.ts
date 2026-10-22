/**
 * Transiciones de estado de pedido / pago (espejo SQL 040).
 * Testeable sin BD.
 */

import type { OrderStatus, PaymentStatus } from '@/lib/orders/types';

const ORDER_EDGES: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending_payment: ['preparing', 'cancelled'],
  request_pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

const PAYMENT_EDGES: Readonly<
  Record<PaymentStatus, readonly PaymentStatus[]>
> = {
  pending_confirmation: ['unpaid', 'paid', 'waived'],
  unpaid: ['paid', 'waived'],
  paid: ['refunded'],
  waived: ['paid'],
  refunded: [],
};

export function isOrderStatusTransitionAllowed(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  if (from === to) return true;
  return (ORDER_EDGES[from] ?? []).includes(to);
}

export function isPaymentStatusTransitionAllowed(
  from: PaymentStatus,
  to: PaymentStatus
): boolean {
  if (from === to) return true;
  return (PAYMENT_EDGES[from] ?? []).includes(to);
}

export function assertOrderStatusTransition(
  from: OrderStatus,
  to: OrderStatus
): { ok: true } | { ok: false; reason: 'invalid_transition' } {
  if (!isOrderStatusTransitionAllowed(from, to)) {
    return { ok: false, reason: 'invalid_transition' };
  }
  return { ok: true };
}

export function assertPaymentStatusTransition(
  from: PaymentStatus,
  to: PaymentStatus
): { ok: true } | { ok: false; reason: 'invalid_transition' } {
  if (!isPaymentStatusTransitionAllowed(from, to)) {
    return { ok: false, reason: 'invalid_transition' };
  }
  return { ok: true };
}

export function nextOrderStatusOptions(from: OrderStatus): OrderStatus[] {
  return (Object.keys(ORDER_EDGES) as OrderStatus[]).filter(
    (to) => to !== from && isOrderStatusTransitionAllowed(from, to)
  );
}

export function nextPaymentStatusOptions(from: PaymentStatus): PaymentStatus[] {
  return (Object.keys(PAYMENT_EDGES) as PaymentStatus[]).filter(
    (to) => to !== from && isPaymentStatusTransitionAllowed(from, to)
  );
}
