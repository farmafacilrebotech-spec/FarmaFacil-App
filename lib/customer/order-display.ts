/**
 * Presentación de pedidos en el área cliente («Mis pedidos»).
 * No altera estados ni importes almacenados: solo etiquetas y criterio de
 * importe confirmado (amount_confirmed_at, alineado con panel farmacia / 058).
 *
 * Archivo autocontenido (sin imports de módulos) para convivir
 * `node --experimental-strip-types` + `tsc` (mismo patrón que lib/tarifas/engine.ts).
 */

/** Espejo de ORDER_STATUSES en lib/orders/types.ts. */
const ORDER_STATUSES = [
  'pending_payment',
  'request_pending',
  'preparing',
  'ready',
  'delivered',
  'cancelled',
] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Copia cliente para solicitud aún no confirmada por la farmacia. */
export const CUSTOMER_REQUEST_PENDING_LABEL = 'Pendiente de confirmar';

/** Texto cuando el importe QR no está confirmado. */
export const CUSTOMER_AMOUNT_PENDING_LABEL = 'Importe pendiente de confirmar';

/**
 * Etiquetas alineadas con el panel farmacia (ORDER_STATUS_LABELS), salvo
 * request_pending → copia orientada al cliente final.
 */
const CUSTOMER_ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Pago pendiente',
  request_pending: CUSTOMER_REQUEST_PENDING_LABEL,
  preparing: 'En preparación',
  ready: 'Listo para recoger',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

function formatEuro(amount: number, currency = 'EUR'): string {
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
 * Espejo de isPublicQrAmountPending (lib/orders/public-qr-display.ts):
 * amount_confirmed_at NOT NULL = confirmado (también 0 €).
 */
function isPublicQrAmountPending(input: {
  source: string;
  amountConfirmedAt?: string | null;
}): boolean {
  if (input.source !== 'public_qr') return false;
  return !input.amountConfirmedAt;
}

/**
 * Etiqueta legible de estado operativo. Nunca devolver snake_case técnico.
 */
export function customerOrderStatusLabel(status: string): string {
  if (isOrderStatus(status)) {
    return CUSTOMER_ORDER_STATUS_LABELS[status];
  }
  return 'Estado desconocido';
}

export type CustomerOrderAmountInput = {
  amount: number;
  currency?: string;
  source: string;
  paymentStatus?: string | null;
  orderStatus?: string | null;
  /** ISO o null. Señál canónica de confirmación (058). */
  amountConfirmedAt?: string | null;
};

/**
 * Importe confirmado solo si amount_confirmed_at está presente (también 0 €).
 * Un total_amount numérico (p. ej. catálogo) NO implica precio confirmado.
 */
export function isCustomerOrderAmountPending(
  input: CustomerOrderAmountInput
): boolean {
  if (input.source === 'public_qr') {
    return isPublicQrAmountPending(input);
  }
  // Otros orígenes: si llega amount_confirmed_at explícitamente null/undefined
  // y payment pending_confirmation, tratar como pendiente por coherencia.
  if (
    input.paymentStatus === 'pending_confirmation' &&
    !input.amountConfirmedAt
  ) {
    return true;
  }
  return false;
}

export function formatCustomerOrderAmount(
  input: CustomerOrderAmountInput
): string {
  if (isCustomerOrderAmountPending(input)) {
    return CUSTOMER_AMOUNT_PENDING_LABEL;
  }
  return formatEuro(input.amount, input.currency ?? 'EUR');
}

export type CustomerOrderSummaryDisplay = {
  status: string;
  totalAmount: number;
  currency: string;
  source: string;
  paymentStatus?: string | null;
  amountConfirmedAt?: string | null;
};

export function customerOrderListPresentation(
  order: CustomerOrderSummaryDisplay
): {
  statusLabel: string;
  amountLabel: string;
} {
  return {
    statusLabel: customerOrderStatusLabel(order.status),
    amountLabel: formatCustomerOrderAmount({
      amount: order.totalAmount,
      currency: order.currency,
      source: order.source,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      amountConfirmedAt: order.amountConfirmedAt,
    }),
  };
}
