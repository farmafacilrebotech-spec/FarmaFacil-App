/**
 * Listado SuperAdmin de pedidos (solo lectura).
 * RLS: platform.pharmacies.read.
 */

import { createClient } from '@/lib/supabase/server';
import { hasPlatformPermission } from '@/lib/auth/platform';

export type SaOrderRow = {
  id: string;
  pharmacyId: string;
  pharmacyName: string | null;
  status: string;
  totalAmount: number | null;
  createdAt: string;
  customerName: string | null;
};

export async function listSaOrders(limit = 100): Promise<
  | { ok: true; orders: SaOrderRow[] }
  | { ok: false; error: string }
> {
  const read = await hasPlatformPermission('platform.pharmacies.read');
  if (!read.ok) {
    return { ok: false, error: 'Sin permiso para consultar pedidos de plataforma.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_orders')
    .select(
      `
      id,
      pharmacy_id,
      status,
      total_amount,
      created_at,
      customer_name,
      pharmacies ( name )
    `
    )
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (error) {
    console.error('[sa-orders]', error.code, error.message);
    return { ok: false, error: 'No se han podido cargar los pedidos.' };
  }

  const orders: SaOrderRow[] = ((data as Record<string, unknown>[] | null) ?? []).map(
    (row) => {
      const ph = row.pharmacies as { name?: string } | null;
      const amount = row.total_amount;
      return {
        id: String(row.id),
        pharmacyId: String(row.pharmacy_id),
        pharmacyName: ph?.name ?? null,
        status: String(row.status ?? ''),
        totalAmount:
          amount == null
            ? null
            : typeof amount === 'string'
              ? Number(amount)
              : Number(amount),
        createdAt: String(row.created_at ?? ''),
        customerName:
          row.customer_name == null ? null : String(row.customer_name),
      };
    }
  );

  return { ok: true, orders };
}
