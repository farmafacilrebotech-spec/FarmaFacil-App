/**
 * Dominio de pedidos FarmaFácil (espejo migración 040).
 * status operativo ≠ payment_status.
 */

export const ORDER_STATUSES = [
  'pending_payment',
  'preparing',
  'ready',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'unpaid',
  'paid',
  'refunded',
  'waived',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_SOURCES = ['kiosk', 'counter', 'online', 'other'] as const;

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
  createdAt: string;
  updatedAt: string;
};

export type PharmacyOrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
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
