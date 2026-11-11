import { createClient } from '@/lib/supabase/server';
import {
  hasKioskInventoryRead,
  hasKioskPurchasingRead,
} from '@/lib/kiosk-inventory/authz';
import type {
  KioskPurchaseDocumentMeta,
  KioskPurchaseDocType,
  KioskPurchaseOrderFinancial,
  KioskPurchaseOrderOperational,
  KioskPurchaseOrderStatus,
} from '@/lib/kiosk-inventory/purchase-types';

type PoRow = {
  id: string;
  supplier_name: string;
  order_number: string | null;
  model: string | null;
  quantity: number;
  received_quantity: number;
  status: string;
  ordered_at: string | null;
  delivery_lead_months: number;
  estimated_delivery_at: string | null;
  notes: string | null;
  general_purchase_order_id?: string | null;
  source_quote_id?: string | null;
  general?: { order_number?: string | null } | { order_number?: string | null }[] | null;
  unit_price_cents: number | null;
  shipping_cents: number | null;
  total_cents: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
};

function generalOrderNumberFromRow(row: PoRow): string | null {
  const g = row.general;
  if (!g) return null;
  const one = Array.isArray(g) ? g[0] : g;
  return one?.order_number == null ? null : String(one.order_number);
}

function mapOperational(row: PoRow): KioskPurchaseOrderOperational {
  const quantity = Number(row.quantity ?? 0);
  const receivedQuantity = Number(row.received_quantity ?? 0);
  const generalOrderNumber = generalOrderNumberFromRow(row);
  return {
    id: row.id,
    supplierName: row.supplier_name,
    orderNumber: generalOrderNumber ?? row.order_number,
    model: row.model,
    quantity,
    receivedQuantity,
    remainingQuantity: Math.max(0, quantity - receivedQuantity),
    status: row.status as KioskPurchaseOrderStatus,
    orderedAt: row.ordered_at,
    deliveryLeadMonths: Number(row.delivery_lead_months ?? 2),
    estimatedDeliveryAt: row.estimated_delivery_at,
    notes: row.notes,
    generalPurchaseOrderId: row.general_purchase_order_id
      ? String(row.general_purchase_order_id)
      : null,
    sourceQuoteId: row.source_quote_id ? String(row.source_quote_id) : null,
    generalOrderNumber,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFinancial(row: PoRow): KioskPurchaseOrderFinancial {
  return {
    ...mapOperational(row),
    unitPriceCents:
      row.unit_price_cents == null ? null : Number(row.unit_price_cents),
    shippingCents:
      row.shipping_cents == null ? null : Number(row.shipping_cents),
    totalCents: row.total_cents == null ? null : Number(row.total_cents),
    currency: row.currency || 'EUR',
  };
}

export async function listKioskPurchaseOrders(): Promise<
  | { ok: true; canSeeFinancial: boolean; orders: KioskPurchaseOrderOperational[] | KioskPurchaseOrderFinancial[] }
  | { ok: false; error: string }
> {
  if (!(await hasKioskInventoryRead()) && !(await hasKioskPurchasingRead())) {
    return { ok: false, error: 'Sin permiso para consultar pedidos de kioskos.' };
  }

  const canSeeFinancial = await hasKioskPurchasingRead();
  const supabase = createClient();
  const selectCols = canSeeFinancial
    ? `
      id, supplier_name, order_number, model, quantity, received_quantity, status,
      ordered_at, delivery_lead_months, estimated_delivery_at, notes,
      general_purchase_order_id, source_quote_id,
      created_at, updated_at,
      general:platform_supplier_purchase_orders!general_purchase_order_id (
        order_number
      ),
      costs:kiosk_purchase_order_costs (
        unit_price_cents, shipping_cents, total_cents, currency
      )
    `
    : `
      id, supplier_name, order_number, model, quantity, received_quantity, status,
      ordered_at, delivery_lead_months, estimated_delivery_at, notes,
      general_purchase_order_id, source_quote_id,
      created_at, updated_at,
      general:platform_supplier_purchase_orders!general_purchase_order_id (
        order_number
      )
    `;

  let { data, error } = await supabase
    .from('kiosk_purchase_orders')
    .select(selectCols)
    .order('created_at', { ascending: false })
    .limit(100);

  // Compatibilidad pre-079
  if (
    error &&
    (String(error.message).toLowerCase().includes('general_purchase_order_id') ||
      String(error.message).toLowerCase().includes('source_quote_id'))
  ) {
    const legacy = canSeeFinancial
      ? `
      id, supplier_name, order_number, model, quantity, received_quantity, status,
      ordered_at, delivery_lead_months, estimated_delivery_at, notes,
      created_at, updated_at,
      costs:kiosk_purchase_order_costs (
        unit_price_cents, shipping_cents, total_cents, currency
      )
    `
      : `
      id, supplier_name, order_number, model, quantity, received_quantity, status,
      ordered_at, delivery_lead_months, estimated_delivery_at, notes,
      created_at, updated_at
    `;
    ({ data, error } = await supabase
      .from('kiosk_purchase_orders')
      .select(legacy)
      .order('created_at', { ascending: false })
      .limit(100));
  }

  if (error) {
    console.error('[kiosk-purchasing] list', error.code, error.message);
    if (
      error.code === '42P01' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        error: 'Falta aplicar la migración 076 (proveedores / compras kioskos).',
      };
    }
    return { ok: false, error: 'No se han podido cargar los pedidos.' };
  }

  const rows = (data ?? []).map((raw) => {
    const r = raw as unknown as PoRow & {
      costs?:
        | {
            unit_price_cents: number | null;
            shipping_cents: number | null;
            total_cents: number | null;
            currency: string;
          }
        | {
            unit_price_cents: number | null;
            shipping_cents: number | null;
            total_cents: number | null;
            currency: string;
          }[]
        | null;
    };
    const costs = Array.isArray(r.costs) ? r.costs[0] : r.costs;
    return {
      ...r,
      unit_price_cents: costs?.unit_price_cents ?? null,
      shipping_cents: costs?.shipping_cents ?? null,
      total_cents: costs?.total_cents ?? null,
      currency: costs?.currency ?? 'EUR',
    } as PoRow;
  });

  const orders = canSeeFinancial
    ? rows.map(mapFinancial)
    : rows.map(mapOperational);

  return { ok: true, canSeeFinancial, orders };
}

export async function listKioskPurchaseDocuments(
  purchaseOrderId: string
): Promise<
  | { ok: true; documents: KioskPurchaseDocumentMeta[] }
  | { ok: false; error: string }
> {
  if (!(await hasKioskPurchasingRead())) {
    return {
      ok: false,
      error:
        'Sin permiso financiero: no puedes consultar presupuestos ni facturas del proveedor.',
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('kiosk_purchase_order_documents')
    .select(
      'id, purchase_order_id, doc_type, storage_path, file_name, mime_type, byte_size, is_current, created_at'
    )
    .eq('purchase_order_id', purchaseOrderId)
    .eq('is_current', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[kiosk-purchasing] docs', error.code, error.message);
    return { ok: false, error: 'No se han podido cargar los documentos.' };
  }

  const documents: KioskPurchaseDocumentMeta[] = (data ?? []).map((d) => ({
    id: d.id as string,
    purchaseOrderId: d.purchase_order_id as string,
    docType: d.doc_type as KioskPurchaseDocType,
    fileName: d.file_name as string,
    mimeType: (d.mime_type as string | null) ?? null,
    byteSize: d.byte_size == null ? null : Number(d.byte_size),
    isCurrent: Boolean(d.is_current),
    createdAt: d.created_at as string,
    storagePath: d.storage_path as string,
  }));

  return { ok: true, documents };
}
