/**
 * Pedidos de compra de kioskos al proveedor (no confundir con presupuestos comerciales).
 */

export const KIOSK_PO_STATUSES = [
  'preparado',
  'pedido',
  'parcialmente_recibido',
  'recibido',
  'cancelado',
] as const;

export type KioskPurchaseOrderStatus = (typeof KIOSK_PO_STATUSES)[number];

export const KIOSK_PO_STATUS_LABELS: Record<KioskPurchaseOrderStatus, string> = {
  preparado: 'Preparado',
  pedido: 'Pedido',
  parcialmente_recibido: 'Parcialmente recibido',
  recibido: 'Recibido',
  cancelado: 'Cancelado',
};

export const KIOSK_PO_DOC_TYPES = [
  'supplier_quote',
  'order_confirmation',
  'invoice',
] as const;

export type KioskPurchaseDocType = (typeof KIOSK_PO_DOC_TYPES)[number];

export const KIOSK_PO_DOC_LABELS: Record<KioskPurchaseDocType, string> = {
  supplier_quote: 'Presupuesto del proveedor',
  order_confirmation: 'Confirmación del pedido',
  invoice: 'Factura',
};

/** Plazo por defecto (meses) para fecha estimada de llegada. */
export const DEFAULT_KIOSK_DELIVERY_LEAD_MONTHS = 2;

export const KIOSK_PURCHASE_STORAGE_BUCKET = 'kiosk-purchase-docs';

/** Vista operativa (soporte / inventario): sin importes. */
export type KioskPurchaseOrderOperational = {
  id: string;
  supplierName: string;
  orderNumber: string | null;
  model: string | null;
  quantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  status: KioskPurchaseOrderStatus;
  orderedAt: string | null;
  deliveryLeadMonths: number;
  estimatedDeliveryAt: string | null;
  notes: string | null;
  /** Pedido económico canónico (079). */
  generalPurchaseOrderId: string | null;
  sourceQuoteId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Vista financiera: incluye importes (solo purchasing). */
export type KioskPurchaseOrderFinancial = KioskPurchaseOrderOperational & {
  unitPriceCents: number | null;
  shippingCents: number | null;
  totalCents: number | null;
  currency: string;
};

export type KioskPurchaseDocumentMeta = {
  id: string;
  purchaseOrderId: string;
  docType: KioskPurchaseDocType;
  fileName: string;
  mimeType: string | null;
  byteSize: number | null;
  isCurrent: boolean;
  createdAt: string;
  /** Solo en respuestas financieras; no se expone a soporte. */
  storagePath?: string;
};

export function computeEstimatedDeliveryAt(
  orderedAt: string | null | undefined,
  leadMonths: number = DEFAULT_KIOSK_DELIVERY_LEAD_MONTHS
): string | null {
  if (!orderedAt) return null;
  const d = new Date(`${orderedAt.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const months = Number.isFinite(leadMonths) ? Math.max(0, Math.min(24, leadMonths)) : 2;
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function stripPurchaseFinancialFields<T extends Record<string, unknown>>(
  row: T
): Omit<T, 'unitPriceCents' | 'shippingCents' | 'totalCents' | 'unit_price_cents' | 'shipping_cents' | 'total_cents'> {
  const copy = { ...row };
  delete (copy as Record<string, unknown>).unitPriceCents;
  delete (copy as Record<string, unknown>).shippingCents;
  delete (copy as Record<string, unknown>).totalCents;
  delete (copy as Record<string, unknown>).unit_price_cents;
  delete (copy as Record<string, unknown>).shipping_cents;
  delete (copy as Record<string, unknown>).total_cents;
  return copy;
}
