/**
 * Dominio de pedidos FarmaFácil (espejo migración 040).
 * status operativo ≠ payment_status.
 */

export const ORDER_STATUSES = [
  'pending_payment',
  'request_pending',
  'preparing',
  'ready',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'unpaid',
  'pending_confirmation',
  'paid',
  'refunded',
  'waived',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_SOURCES = [
  'kiosk',
  'counter',
  'online',
  'other',
  'public_qr',
] as const;

export type OrderSource = (typeof ORDER_SOURCES)[number];

export type CartLineInput = {
  productId: string;
  quantity: number;
  /** Si el cliente lo envía, se valida contra el precio servidor y se descarta. */
  clientUnitPrice?: number | null;
};

export type ResolvedCartLine = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type PharmacyOrderSummary = {
  id: string;
  pharmacyId: string;
  orderNumber: number;
  displayNumber: string;
  source: OrderSource;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  currency: string;
  deviceId: string | null;
  /** Solo staff; solicitudes public_qr (migración 057). */
  customerName: string | null;
  customerPhone: string | null;
  /** Nota opcional del cliente (public_qr). */
  customerNote: string | null;
  /**
   * NULL = importe técnico/pendiente (sentinel 0 ≠ confirmado).
   * ISO timestamp = farmacia confirmó total_amount (puede ser 0 €).
   */
  amountConfirmedAt: string | null;
  amountConfirmedBy: string | null;
  /** Valoración por línea (060). NULL = no valorado o solo total legacy 058. */
  linesValuedAt: string | null;
  linesValuedBy: string | null;
  /** Aceptación del cliente del presupuesto (R4). NULL = no aceptado. */
  customerAcceptedAt: string | null;
  customerAcceptedBy: string | null;
  /** Rechazo del cliente (R4). */
  customerRejectedAt: string | null;
  /** Versión del presupuesto vigente (R4). 0 = no valorado. */
  quoteVersion: number;
  /** Caducidad de la versión vigente (R4). */
  quoteExpiresAt: string | null;
  /** Histórico sellado en apply 060 (total 058 sin desglose). */
  quoteLegacyTotalOnly: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OrderLineAvailabilityStatus =
  | 'pending'
  | 'available'
  | 'unavailable';

export type PharmacyOrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Ausente/pending si la columna 060 aún no existe o no se valoró. */
  availabilityStatus: OrderLineAvailabilityStatus;
  staffNote: string | null;
  pricedAt: string | null;
  pricedBy: string | null;
};

export type PharmacyOrderDetail = PharmacyOrderSummary & {
  items: PharmacyOrderItem[];
};

export type CreateOrderOk = {
  ok: true;
  idempotent: boolean;
  orderId: string;
  pharmacyId: string;
  orderNumber: number;
  displayNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  currency: string;
};

export type CreateOrderErrorCode =
  | 'session_missing'
  | 'session_invalid'
  | 'session_revoked'
  | 'commercially_blocked'
  | 'empty_cart'
  | 'invalid_cart'
  | 'invalid_product'
  | 'invalid_quantity'
  | 'product_inactive'
  | 'product_not_found'
  | 'product_wrong_pharmacy'
  | 'price_mismatch'
  | 'duplicate_product_in_cart'
  | 'invalid_request'
  | 'unavailable';

export type CreateOrderResult =
  | CreateOrderOk
  | { ok: false; code: CreateOrderErrorCode; message: string };
