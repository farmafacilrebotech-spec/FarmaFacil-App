/**
 * Clientes de una farmacia = perfiles con al menos un pedido vinculado
 * (pharmacy_orders.customer_profile_id) a ESA farmacia.
 * No usa customer_saved_pharmacies (Mis farmacias ≠ consentimiento CRM).
 *
 * Preferencia: RPC con gate de rol (oculta customer_profile_id a STAFF en PostgREST).
 * Fallback: SELECT directo si la RPC aún no está desplegada.
 */

import { createClient } from '@/lib/supabase/server';
import { requirePharmacyClientsAccess } from '@/lib/pharmacies/pharmacy-clients-access';
import { aggregateLinkedClientsFromOrders } from '@/lib/pharmacies/pharmacy-clients-aggregate';

export type PharmacyClientListItem = {
  customerProfileId: string;
  /** Nombre facilitado en pedidos (dato operativo autorizado). */
  displayName: string;
  /** Teléfono solo si apareció en algún pedido de esta farmacia. */
  phone: string | null;
  firstLinkedAt: string;
  lastOrderAt: string;
  orderCount: number;
};

export type PharmacyClientOrderRow = {
  id: string;
  displayNumber: string;
  status: string;
  source: string;
  totalAmount: number;
  currency: string;
  amountConfirmedAt: string | null;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
};

type OrderAggRow = {
  id: string;
  customer_profile_id: string;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  display_number: string;
  status: string;
  source: string;
  total_amount: number | null;
  currency: string | null;
  amount_confirmed_at: string | null;
};

function mapClient(raw: Record<string, unknown>): PharmacyClientListItem | null {
  const id = String(raw.customerProfileId ?? raw.customer_profile_id ?? '');
  if (!id) return null;
  return {
    customerProfileId: id,
    displayName: String(raw.displayName ?? raw.display_name ?? 'Cliente'),
    phone:
      raw.phone == null || raw.phone === ''
        ? null
        : String(raw.phone),
    firstLinkedAt: String(raw.firstLinkedAt ?? raw.first_linked_at ?? ''),
    lastOrderAt: String(raw.lastOrderAt ?? raw.last_order_at ?? ''),
    orderCount: Number(raw.orderCount ?? raw.order_count ?? 0),
  };
}

function isMissingRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42883' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the function')
  );
}

export async function listPharmacyLinkedClients(
  pharmacyId: string,
  limit = 100
): Promise<
  | { ok: true; clients: PharmacyClientListItem[] }
  | { ok: false; error: string }
> {
  const gate = await requirePharmacyClientsAccess(pharmacyId);
  if (!gate.ok) return gate;

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_list_pharmacy_linked_clients_v1', {
    p_pharmacy_id: pharmacyId,
    p_limit: Math.min(Math.max(limit, 1), 200),
  });

  if (!error && data && typeof data === 'object') {
    const payload = data as Record<string, unknown>;
    const status = String(payload.status ?? '');
    if (status === 'forbidden' || status === 'unauthenticated') {
      return { ok: false, error: 'No tienes acceso al listado de clientes.' };
    }
    if (status === 'ok' && Array.isArray(payload.clients)) {
      const clients = (payload.clients as Record<string, unknown>[])
        .map(mapClient)
        .filter((c): c is PharmacyClientListItem => Boolean(c));
      return { ok: true, clients };
    }
  }

  if (error && !isMissingRpc(error)) {
    console.error('[pharmacy-clients] list rpc', error.code, error.message);
    return {
      ok: false,
      error: 'No se han podido cargar los clientes vinculados a esta farmacia.',
    };
  }

  // Fallback sin RPC (p. ej. prod aún sin el SQL de endurecimiento).
  return listPharmacyLinkedClientsViaSelect(pharmacyId, limit);
}

async function listPharmacyLinkedClientsViaSelect(
  pharmacyId: string,
  limit: number
): Promise<
  | { ok: true; clients: PharmacyClientListItem[] }
  | { ok: false; error: string }
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_orders')
    .select(
      'id, customer_profile_id, customer_name, customer_phone, created_at, display_number, status, source, total_amount, currency, amount_confirmed_at'
    )
    .eq('pharmacy_id', pharmacyId)
    .not('customer_profile_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500) * 5);

  if (error) {
    console.error('[pharmacy-clients] list', error.code, error.message);
    if (
      error.code === '42703' ||
      /customer_profile_id/i.test(error.message) ||
      /permission denied.*customer_profile_id/i.test(error.message)
    ) {
      return {
        ok: false,
        error:
          'No se puede listar el vínculo de clientes en pedidos (columna o privilegio ausente). Usa la RPC ff_list_pharmacy_linked_clients_v1.',
      };
    }
    return {
      ok: false,
      error: 'No se han podido cargar los clientes vinculados a esta farmacia.',
    };
  }

  const clients = aggregateLinkedClientsFromOrders(
    ((data as OrderAggRow[] | null) ?? []).map((raw) => ({
      customerProfileId: raw.customer_profile_id,
      customerName: raw.customer_name,
      customerPhone: raw.customer_phone,
      createdAt: raw.created_at,
    })),
    limit
  );

  return { ok: true, clients };
}

export async function getPharmacyLinkedClientDetail(
  pharmacyId: string,
  customerProfileId: string
): Promise<
  | {
      ok: true;
      client: PharmacyClientListItem;
      orders: PharmacyClientOrderRow[];
    }
  | { ok: false; error: string }
> {
  const gate = await requirePharmacyClientsAccess(pharmacyId);
  if (!gate.ok) return gate;
  if (!customerProfileId || !/^[0-9a-f-]{36}$/i.test(customerProfileId)) {
    return { ok: false, error: 'Cliente no válido.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_get_pharmacy_linked_client_v1', {
    p_pharmacy_id: pharmacyId,
    p_customer_profile_id: customerProfileId,
  });

  if (!error && data && typeof data === 'object') {
    const payload = data as Record<string, unknown>;
    const status = String(payload.status ?? '');
    if (status === 'forbidden' || status === 'unauthenticated') {
      return { ok: false, error: 'No tienes acceso a la ficha de cliente.' };
    }
    if (status === 'not_found' || status === 'invalid') {
      return {
        ok: false,
        error:
          'No hay pedidos vinculados de este cliente en esta farmacia (o no tienes acceso).',
      };
    }
    if (status === 'ok' && payload.client && Array.isArray(payload.orders)) {
      const client = mapClient(payload.client as Record<string, unknown>);
      if (!client) {
        return { ok: false, error: 'No se ha podido cargar la ficha del cliente.' };
      }
      const orders: PharmacyClientOrderRow[] = (
        payload.orders as Record<string, unknown>[]
      ).map((o) => ({
        id: String(o.id),
        displayNumber: String(o.displayNumber ?? o.display_number ?? ''),
        status: String(o.status ?? ''),
        source: String(o.source ?? 'other'),
        totalAmount: Number(o.totalAmount ?? o.total_amount ?? 0),
        currency: String(o.currency ?? 'EUR'),
        amountConfirmedAt:
          o.amountConfirmedAt == null && o.amount_confirmed_at == null
            ? null
            : String(o.amountConfirmedAt ?? o.amount_confirmed_at),
        createdAt: String(o.createdAt ?? o.created_at ?? ''),
        customerName:
          o.customerName == null && o.customer_name == null
            ? null
            : String(o.customerName ?? o.customer_name),
        customerPhone:
          o.customerPhone == null && o.customer_phone == null
            ? null
            : String(o.customerPhone ?? o.customer_phone),
      }));
      return { ok: true, client, orders };
    }
  }

  if (error && !isMissingRpc(error)) {
    console.error('[pharmacy-clients] detail rpc', error.code, error.message);
    return { ok: false, error: 'No se ha podido cargar la ficha del cliente.' };
  }

  return getPharmacyLinkedClientDetailViaSelect(pharmacyId, customerProfileId);
}

async function getPharmacyLinkedClientDetailViaSelect(
  pharmacyId: string,
  customerProfileId: string
): Promise<
  | {
      ok: true;
      client: PharmacyClientListItem;
      orders: PharmacyClientOrderRow[];
    }
  | { ok: false; error: string }
> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_orders')
    .select(
      'id, customer_profile_id, customer_name, customer_phone, created_at, display_number, status, source, total_amount, currency, amount_confirmed_at'
    )
    .eq('pharmacy_id', pharmacyId)
    .eq('customer_profile_id', customerProfileId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[pharmacy-clients] detail', error.code, error.message);
    return { ok: false, error: 'No se ha podido cargar la ficha del cliente.' };
  }

  const rows = (data as OrderAggRow[] | null) ?? [];
  if (rows.length === 0) {
    return {
      ok: false,
      error:
        'No hay pedidos vinculados de este cliente en esta farmacia (o no tienes acceso).',
    };
  }

  const [client] = aggregateLinkedClientsFromOrders(
    rows.map((r) => ({
      customerProfileId: r.customer_profile_id,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      createdAt: r.created_at,
    })),
    1
  );

  if (!client) {
    return {
      ok: false,
      error:
        'No hay pedidos vinculados de este cliente en esta farmacia (o no tienes acceso).',
    };
  }

  return {
    ok: true,
    client,
    orders: rows.map((r) => ({
      id: r.id,
      displayNumber: r.display_number,
      status: r.status,
      source: r.source ?? 'other',
      totalAmount: Number(r.total_amount ?? 0),
      currency: r.currency ?? 'EUR',
      amountConfirmedAt: r.amount_confirmed_at,
      createdAt: r.created_at,
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
    })),
  };
}
