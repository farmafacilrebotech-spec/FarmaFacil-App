import type {
  OrderSource,
  OrderStatus,
  PaymentStatus,
} from '@/lib/orders/types';
import {
  filterPaymentOptionsForPublicQrAmount,
  formatPublicQrOrEuroAmount,
  isPublicQrAmountPending as isPublicQrAmountPendingShared,
} from '@/lib/orders/public-qr-display';

export {
  nextOrderStatusOptions,
  nextPaymentStatusOptions,
} from '@/lib/orders/transitions';

import { nextPaymentStatusOptions } from '@/lib/orders/transitions';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Pago pendiente',
  request_pending: 'Solicitud pendiente',
  preparing: 'En preparación',
  ready: 'Listo para recoger',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Sin cobrar',
  pending_confirmation: 'Pendiente de confirmar',
  paid: 'Cobrado',
  refunded: 'Reembolsado',
  waived: 'Exento',
};

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  kiosk: 'Kiosko',
  counter: 'Mostrador',
  online: 'Online',
  other: 'Otro',
  public_qr: 'Catálogo QR',
};

export function formatEuro(amount: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/**
 * Importe en listados/detalle.
 * Solicitud QR con pending_confirmation → nunca presentar 0€ como precio final ni venta gratuita.
 */
export function formatOrderAmount(input: {
  amount: number;
  currency?: string;
  source: OrderSource;
  paymentStatus?: PaymentStatus;
  orderStatus?: OrderStatus;
  amountConfirmedAt?: string | null;
}): string {
  return formatPublicQrOrEuroAmount({
    ...input,
    formatEuro,
  });
}

/** Solicitud QR aún sin importe confirmado (total técnico 0 ≠ gratuito). */
export function isPublicQrAmountPending(input: {
  amount: number;
  source: OrderSource;
  paymentStatus?: PaymentStatus;
  orderStatus?: OrderStatus;
  amountConfirmedAt?: string | null;
}): boolean {
  return isPublicQrAmountPendingShared(input);
}

/**
 * Opciones de pago para el panel.
 * En solicitud QR con importe no confirmado no se ofrece «Cobrado».
 */
export function nextPaymentStatusOptionsForOrder(input: {
  source: OrderSource;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  orderStatus?: OrderStatus;
  amountConfirmedAt?: string | null;
}): PaymentStatus[] {
  return filterPaymentOptionsForPublicQrAmount(
    nextPaymentStatusOptions(input.paymentStatus),
    {
      amount: input.totalAmount,
      source: input.source,
      paymentStatus: input.paymentStatus,
      orderStatus: input.orderStatus,
      amountConfirmedAt: input.amountConfirmedAt,
    }
  );
}
