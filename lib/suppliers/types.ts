export const SUPPLIER_STATUSES = ['active', 'archived'] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const SUPPLIER_CATEGORIES = [
  'merchandising',
  'papeleria',
  'imprentas',
  'marketing',
  'kioskos',
  'tecnologia',
  'servicios',
  'otros',
] as const;
export type SupplierCategory = (typeof SUPPLIER_CATEGORIES)[number];

export const SUPPLIER_CATEGORY_LABELS: Record<SupplierCategory, string> = {
  merchandising: 'Merchandising',
  papeleria: 'Papelería',
  imprentas: 'Imprentas',
  marketing: 'Marketing',
  kioskos: 'Kioskos',
  tecnologia: 'Tecnología',
  servicios: 'Servicios',
  otros: 'Otros',
};

export function isSupplierCategory(value: string | null | undefined): value is SupplierCategory {
  return (
    !!value &&
    (SUPPLIER_CATEGORIES as readonly string[]).includes(value)
  );
}

export const SUPPLIER_QUOTE_STATUSES = [
  'recibido',
  'en_revision',
  'aprobado',
  'rechazado',
  'caducado',
] as const;
export type SupplierQuoteStatus = (typeof SUPPLIER_QUOTE_STATUSES)[number];

export const SUPPLIER_QUOTE_STATUS_LABELS: Record<SupplierQuoteStatus, string> = {
  recibido: 'Recibido',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  caducado: 'Caducado',
};

export const SUPPLIER_PO_STATUSES = [
  'borrador',
  'pedido',
  'parcial',
  'recibido',
  'facturado',
  'cancelado',
] as const;
export type SupplierPurchaseStatus = (typeof SUPPLIER_PO_STATUSES)[number];

export const SUPPLIER_PO_STATUS_LABELS: Record<SupplierPurchaseStatus, string> = {
  borrador: 'Borrador',
  pedido: 'Pedido',
  parcial: 'Parcial',
  recibido: 'Recibido',
  facturado: 'Facturado',
  cancelado: 'Cancelado',
};

export const SUPPLIER_PO_DOC_TYPES = [
  'quote',
  'order_confirmation',
  'invoice',
  'receipt',
  'other',
] as const;
export type SupplierPurchaseDocType = (typeof SUPPLIER_PO_DOC_TYPES)[number];

export const SUPPLIER_PO_DOC_LABELS: Record<SupplierPurchaseDocType, string> = {
  quote: 'Presupuesto',
  order_confirmation: 'Confirmación',
  invoice: 'Factura',
  receipt: 'Justificante',
  other: 'Otro',
};

export const SUPPLIER_DOCS_BUCKET = 'supplier-docs';

export type SupplierRow = {
  id: string;
  legalName: string;
  tradeName: string | null;
  taxId: string | null;
  category: SupplierCategory;
  email: string | null;
  phone: string | null;
  website: string | null;
  paymentTerms: string | null;
  notes: string | null;
  status: SupplierStatus;
  createdAt: string;
  updatedAt: string;
};

export type SupplierContactRow = {
  id: string;
  supplierId: string;
  fullName: string;
  roleTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
};

export type SupplierActivityRow = {
  id: string;
  supplierId: string;
  action: string;
  summary: string;
  createdAt: string;
};

export type SupplierQuoteRow = {
  id: string;
  supplierId: string;
  supplierName: string | null;
  quoteNumber: string | null;
  title: string;
  status: SupplierQuoteStatus;
  receivedAt: string | null;
  validUntil: string | null;
  currency: string;
  shippingCents: number | null;
  notes: string | null;
  createdAt: string;
};

export type SupplierQuoteLineRow = {
  id: string;
  quoteId: string;
  materialKey: string;
  description: string;
  quantity: number;
  unit: string | null;
  unitPriceCents: number;
  vatBps: number;
  leadDays: number | null;
};

export type SupplierQuoteDocumentRow = {
  id: string;
  quoteId: string;
  fileName: string;
  mimeType: string | null;
  byteSize: number | null;
  storagePath: string;
  createdAt: string;
};

export type MaterialOfferCompareRow = {
  materialKey: string;
  description: string;
  supplierId: string;
  supplierName: string;
  quoteId: string;
  quoteTitle: string;
  unitPriceCents: number;
  quantity: number;
  leadDays: number | null;
  quoteStatus: SupplierQuoteStatus;
};

export type SupplierPurchaseOrderRow = {
  id: string;
  supplierId: string;
  supplierName: string | null;
  quoteId: string | null;
  category: SupplierCategory;
  title: string;
  orderNumber: string | null;
  status: SupplierPurchaseStatus;
  orderedAt: string | null;
  expectedDeliveryAt: string | null;
  actualDeliveryAt: string | null;
  currency: string;
  subtotalCents: number | null;
  taxCents: number | null;
  shippingCents: number | null;
  totalCents: number | null;
  notes: string | null;
  createdAt: string;
};

export type SupplierPurchaseDocumentRow = {
  id: string;
  purchaseOrderId: string;
  docType: SupplierPurchaseDocType;
  fileName: string;
  mimeType: string | null;
  byteSize: number | null;
  storagePath: string;
  createdAt: string;
};
