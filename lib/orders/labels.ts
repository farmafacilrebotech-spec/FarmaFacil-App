import type { OrderStatus, PaymentStatus } from '@/lib/orders/types';

export {
  nextOrderStatusOptions,
  nextPaymentStatusOptions,
} from '@/lib/orders/transitions';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Pago pendiente',
  preparing: 'En preparación',
  ready: 'Listo para recoger',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Sin cobrar',
  paid: 'Cobrado',
  refunded: 'Reembolsado',
  waived: 'Exento',
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
