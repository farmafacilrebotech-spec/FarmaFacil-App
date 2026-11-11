/**
 * Clientes de una farmacia = perfiles con al menos un pedido vinculado
 * (pharmacy_orders.customer_profile_id) a ESA farmacia.
 * No usa customer_saved_pharmacies (Mis farmacias ≠ consentimiento CRM).
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
      /customer_profile_id/i.test(error.message)
    ) {
      return {
        ok: false,
        error:
          'Esta base de datos aún no tiene el vínculo de clientes en pedidos (migración 064+). En producción ya está disponible; en staging hay que aplicarla antes de la prueba completa.',
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
