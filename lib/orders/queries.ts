import { createClient } from '@/lib/supabase/server';
import { requireOrdersView } from '@/lib/orders/authz';
import type {
  OrderLineAvailabilityStatus,
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
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_note?: string | null;
  amount_confirmed_at?: string | null;
  amount_confirmed_by?: string | null;
  lines_valued_at?: string | null;
  lines_valued_by?: string | null;
  customer_accepted_at?: string | null;
  customer_accepted_by?: string | null;
  customer_rejected_at?: string | null;
  quote_version?: number | null;
  quote_expires_at?: string | null;
  quote_legacy_total_only?: boolean | null;
  created_at: string;
  updated_at: string;
};

const ORDER_SELECT_BASE = `
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
`;

const ORDER_SELECT_WITH_CONTACT = `
  ${ORDER_SELECT_BASE},
  customer_name,
  customer_phone,
  customer_note
`;

const ORDER_SELECT_WITH_AMOUNT = `
  ${ORDER_SELECT_WITH_CONTACT},
  amount_confirmed_at,
  amount_confirmed_by
`;

const ORDER_SELECT_FULL = `
  ${ORDER_SELECT_WITH_AMOUNT},
  lines_valued_at,
  lines_valued_by,
  customer_accepted_at,
  customer_accepted_by,
  customer_rejected_at,
  quote_version,
  quote_expires_at,
  quote_legacy_total_only
`;

const ORDER_SELECT_R3 = `
  ${ORDER_SELECT_WITH_AMOUNT},
  lines_valued_at,
  lines_valued_by,
  customer_accepted_at,
  customer_accepted_by,
  quote_legacy_total_only
`;

type ItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
  availability_status?: string | null;
  staff_note?: string | null;
  priced_at?: string | null;
  priced_by?: string | null;
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
    customerName: row.customer_name ?? null,
    customerPhone: row.customer_phone ?? null,
    customerNote: row.customer_note ?? null,
    amountConfirmedAt: row.amount_confirmed_at ?? null,
    amountConfirmedBy: row.amount_confirmed_by ?? null,
    linesValuedAt: row.lines_valued_at ?? null,
    linesValuedBy: row.lines_valued_by ?? null,
    customerAcceptedAt: row.customer_accepted_at ?? null,
    customerAcceptedBy: row.customer_accepted_by ?? null,
    customerRejectedAt: row.customer_rejected_at ?? null,
    quoteVersion:
      typeof row.quote_version === 'number'
        ? row.quote_version
        : Number(row.quote_version ?? 0) || 0,
    quoteExpiresAt: row.quote_expires_at ?? null,
    quoteLegacyTotalOnly: row.quote_legacy_total_only === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isMissingOptionalColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('customer_name') ||
    m.includes('customer_phone') ||
    m.includes('customer_note') ||
    m.includes('amount_confirmed_at') ||
    m.includes('amount_confirmed_by') ||
    m.includes('lines_valued_at') ||
    m.includes('lines_valued_by') ||
    m.includes('customer_accepted_at') ||
    m.includes('customer_accepted_by') ||
    m.includes('customer_rejected_at') ||
    m.includes('quote_version') ||
    m.includes('quote_expires_at') ||
    m.includes('quote_legacy_total_only') ||
    m.includes('availability_status') ||
    m.includes('staff_note') ||
    m.includes('priced_at') ||
    m.includes('priced_by') ||
    (m.includes('column') && m.includes('does not exist'))
  );
}

function mapAvailability(
  value: string | null | undefined
): OrderLineAvailabilityStatus {
  if (value === 'available' || value === 'unavailable' || value === 'pending') {
    return value;
  }
  return 'pending';
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
    availabilityStatus: mapAvailability(row.availability_status),
    staffNote: row.staff_note ?? null,
    pricedAt: row.priced_at ?? null,
    pricedBy: row.priced_by ?? null,
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

  const run = (select: string) => {
    let q = supabase
      .from('pharmacy_orders')
      .select(select)
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (options?.status) {
      q = q.eq('status', options.status);
    }
    return q;
  };

  let { data, error } = await run(ORDER_SELECT_FULL);
  if (error && isMissingOptionalColumnError(error.message)) {
    ({ data, error } = await run(ORDER_SELECT_R3));
  }
  if (error && isMissingOptionalColumnError(error.message)) {
    ({ data, error } = await run(ORDER_SELECT_WITH_AMOUNT));
  }
  if (error && isMissingOptionalColumnError(error.message)) {
    ({ data, error } = await run(ORDER_SELECT_WITH_CONTACT));
  }
  if (error && isMissingOptionalColumnError(error.message)) {
    ({ data, error } = await run(ORDER_SELECT_BASE));
  }

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
  let { data: orderRow, error: orderError } = await supabase
    .from('pharmacy_orders')
    .select(ORDER_SELECT_FULL)
    .eq('id', orderId)
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();

  if (orderError && isMissingOptionalColumnError(orderError.message)) {
    ({ data: orderRow, error: orderError } = await supabase
      .from('pharmacy_orders')
      .select(ORDER_SELECT_R3)
      .eq('id', orderId)
      .eq('pharmacy_id', pharmacyId)
      .maybeSingle());
  }
  if (orderError && isMissingOptionalColumnError(orderError.message)) {
    ({ data: orderRow, error: orderError } = await supabase
      .from('pharmacy_orders')
      .select(ORDER_SELECT_WITH_AMOUNT)
      .eq('id', orderId)
      .eq('pharmacy_id', pharmacyId)
      .maybeSingle());
  }
  if (orderError && isMissingOptionalColumnError(orderError.message)) {
    ({ data: orderRow, error: orderError } = await supabase
      .from('pharmacy_orders')
      .select(ORDER_SELECT_WITH_CONTACT)
      .eq('id', orderId)
      .eq('pharmacy_id', pharmacyId)
      .maybeSingle());
  }
  if (orderError && isMissingOptionalColumnError(orderError.message)) {
    ({ data: orderRow, error: orderError } = await supabase
      .from('pharmacy_orders')
      .select(ORDER_SELECT_BASE)
      .eq('id', orderId)
      .eq('pharmacy_id', pharmacyId)
      .maybeSingle());
  }

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

  const ITEM_SELECT_FULL = `
      id,
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      line_total,
      availability_status,
      staff_note,
      priced_at,
      priced_by
    `;
  const ITEM_SELECT_BASE = `
      id,
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      line_total
    `;

  let itemRows: ItemRow[] | null = null;
  let itemsError: { message: string } | null = null;

  {
    const full = await supabase
      .from('pharmacy_order_items')
      .select(ITEM_SELECT_FULL)
      .eq('order_id', orderId)
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: true });
    itemsError = full.error;
    itemRows = (full.data as ItemRow[] | null) ?? null;
  }

  if (itemsError && isMissingOptionalColumnError(itemsError.message)) {
    const base = await supabase
      .from('pharmacy_order_items')
      .select(ITEM_SELECT_BASE)
      .eq('order_id', orderId)
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: true });
    itemsError = base.error;
    itemRows = (base.data as ItemRow[] | null) ?? null;
  }

  if (itemsError) {
    console.error('[orders] items', itemsError.message);
    return { ok: false, error: 'No se han podido cargar las líneas del pedido.' };
  }

  return {
    ok: true,
    order: {
      ...mapOrder(orderRow as OrderRow),
      items: (itemRows ?? []).map(mapItem),
    },
  };
}
