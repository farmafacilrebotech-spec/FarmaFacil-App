'use server';

import { createKioskOrderFromCart } from '@/lib/orders/create-order';
import type { CartLineInput, CreateOrderResult } from '@/lib/orders/types';
import { createClient } from '@/lib/supabase/server';
import { sha256Hex } from '@/lib/kiosk/crypto';
import {
  clearKioskSessionCookie,
  parseKioskSessionCookie,
  readKioskSessionCookie,
} from '@/lib/kiosk/session-cookie';

/**
 * Server Action: crear pedido desde el kiosko (sin login de cliente).
 * Requiere cookie HttpOnly de sesión de dispositivo.
 */
export async function createKioskOrderAction(input: {
  lines: CartLineInput[];
  clientRequestId: string;
}): Promise<CreateOrderResult> {
  return createKioskOrderFromCart(input);
}

export type KioskOrderDetailResult =
  | {
      ok: true;
      order: {
        id: string;
        displayNumber: string;
        status: string;
        paymentStatus: string;
        totalAmount: number;
        currency: string;
        items: Array<{
          productName: string;
          quantity: number;
          unitPrice: number;
          lineTotal: number;
        }>;
      };
    }
  | { ok: false; error: string };

/**
 * Detalle del pedido creado en este dispositivo (confirmación al cliente).
 */
export async function getKioskOrderAction(
  orderId: string
): Promise<KioskOrderDetailResult> {
  const raw = readKioskSessionCookie();
  const parsed = parseKioskSessionCookie(raw);
  if (!parsed) {
    return { ok: false, error: 'Sesión de kiosko no válida.' };
  }
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return { ok: false, error: 'Pedido no válido.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_get_order_v1', {
    p_credential_hash: sha256Hex(parsed.credential),
    p_order_id: orderId,
  });

  if (error) {
    console.error('[orders] kiosk get', error.message);
    return { ok: false, error: 'No se ha podido cargar el pedido.' };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status === 'session_revoked' || status === 'session_invalid') {
    clearKioskSessionCookie();
    return { ok: false, error: 'Sesión de kiosko no válida.' };
  }
  if (status === 'forbidden' || status === 'not_found') {
    return { ok: false, error: 'Pedido no disponible en este dispositivo.' };
  }
  if (status !== 'ok' || !payload?.order) {
    return { ok: false, error: 'No se ha podido cargar el pedido.' };
  }

  const order = payload.order as Record<string, unknown>;
  const itemsRaw = Array.isArray(order.items) ? order.items : [];

  return {
    ok: true,
    order: {
      id: String(order.id),
      displayNumber: String(order.display_number),
      status: String(order.order_status),
      paymentStatus: String(order.payment_status),
      totalAmount: Number(order.total_amount),
      currency: String(order.currency ?? 'EUR'),
      items: itemsRaw.map((rawItem) => {
        const item = rawItem as Record<string, unknown>;
        return {
          productName: String(item.product_name ?? ''),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          lineTotal: Number(item.line_total),
        };
      }),
    },
  };
}
