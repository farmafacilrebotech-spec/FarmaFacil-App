import { createClient } from '@/lib/supabase/server';
import { requireOrdersView } from '@/lib/orders/authz';
import type {
  OrderSource,
  OrderStatus,
  PaymentStatus,
  PharmacyOrderDetail,
  PharmacyOrderItem,
  PharmacyOrderSummary,
} from '@/lib/orders/types';

type OrderRow = {
  id: string;
  pharmacy_id: string;
  order_number: number;
  display_number: string;
  source: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
  currency: string;
  device_id: string | null;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
};

function mapOrder(row: OrderRow): PharmacyOrderSummary {
  return {
    id: row.id,
    pharmacyId: row.pharmacy_id,
    orderNumber: row.order_number,
    displayNumber: row.display_number,
    source: row.source as OrderSource,
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    totalAmount:
      typeof row.total_amount === 'string'
        ? Number(row.total_amount)
        : row.total_amount,
    currency: row.currency,
    deviceId: row.device_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row: ItemRow): PharmacyOrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    productName: row.product_name,
    quantity: row.quantity,
    unitPrice:
      typeof row.unit_price === 'string'
        ? Number(row.unit_price)
        : row.unit_price,
    lineTotal:
      typeof row.line_total === 'string'
        ? Number(row.line_total)
        : row.line_total,
  };
}

export async function listPharmacyOrders(
  pharmacyId: string,
  options?: { status?: OrderStatus; limit?: number }
): Promise<
  | { ok: true; orders: PharmacyOrderSummary[] }
  | { ok: false; error: string }
> {
  const auth = await requireOrdersView(pharmacyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const supabase = createClient();
  let query = supabase
    .from('pharmacy_orders')
    .select(
      `
      id,
      pharmacy_id,
      order_number,
      display_number,
      source,
      status,
      payment_status,
      total_amount,
      currency,
      device_id,
      created_at,
      updated_at
    `
    )
    .eq('pharmacy_id', pharmacyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[orders] list', error.message);
    return { ok: false, error: 'No se han podido cargar los pedidos.' };
  }

  return {
    ok: true,
    orders: ((data as OrderRow[] | null) ?? []).map(mapOrder),
  };
}

export async function getPharmacyOrderDetail(
  pharmacyId: string,
  orderId: string
): Promise<
  | { ok: true; order: PharmacyOrderDetail }
  | { ok: false; error: string; reason?: 'forbidden' | 'not_found' }
> {
  const auth = await requireOrdersView(pharmacyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error, reason: 'forbidden' };
  }

  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return { ok: false, error: 'Pedido no válido.', reason: 'not_found' };
  }

  const supabase = createClient();
  const { data: orderRow, error: orderError } = await supabase
    .from('pharmacy_orders')
    .select(
      `
      id,
      pharmacy_id,
      order_number,
      display_number,
      source,
      status,
      payment_status,
      total_amount,
      currency,
      device_id,
      created_at,
      updated_at
    `
    )
    .eq('id', orderId)
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();

  if (orderError) {
    console.error('[orders] get', orderError.message);
    return { ok: false, error: 'No se ha podido cargar el pedido.' };
  }
  if (!orderRow) {
    return {
      ok: false,
      error: 'Pedido no encontrado.',
      reason: 'not_found',
    };
  }

  const { data: itemRows, error: itemsError } = await supabase
    .from('pharmacy_order_items')
    .select(
      `
      id,
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      line_total
    `
    )
    .eq('order_id', orderId)
    .eq('pharmacy_id', pharmacyId)
    .order('created_at', { ascending: true });

  if (itemsError) {
    console.error('[orders] items', itemsError.message);
    return { ok: false, error: 'No se han podido cargar las líneas del pedido.' };
  }

  return {
    ok: true,
    order: {
      ...mapOrder(orderRow as OrderRow),
      items: ((itemRows as ItemRow[] | null) ?? []).map(mapItem),
    },
  };
}
