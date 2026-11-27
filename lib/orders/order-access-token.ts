import { createHash, randomBytes } from 'node:crypto';

import { sha256Hex } from '@/lib/kiosk/crypto';
import {
  parseKioskSessionCookie,
  readKioskSessionCookie,
} from '@/lib/kiosk/session-cookie';
import {
  orderAccessPublicBaseUrl,
  orderAccessPublicUrl,
} from '@/lib/orders/order-access-public-url';
import { createClient } from '@/lib/supabase/server';

export {
  orderAccessPublicBaseUrl,
  orderAccessPublicUrl,
} from '@/lib/orders/order-access-public-url';

export function generateOrderAccessTokenPlaintext(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOrderAccessTokenLocal(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Emite token de consulta para un pedido kiosko de esta sesión de dispositivo.
 * El plaintext solo vive en esta respuesta (no se loguea).
 */
export async function issueKioskOrderAccessUrl(orderId: string): Promise<{
  ok: true;
  url: string;
  expiresAt: string;
} | {
  ok: false;
  error: string;
}> {
  const raw = readKioskSessionCookie();
  const parsed = parseKioskSessionCookie(raw);
  if (!parsed) {
    return { ok: false, error: 'Sesión de kiosko no válida.' };
  }
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return { ok: false, error: 'Pedido no válido.' };
  }

  const token = generateOrderAccessTokenPlaintext();
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_kiosk_issue_order_access_token_v1',
    {
      p_credential_hash: sha256Hex(parsed.credential),
      p_order_id: orderId,
      p_token_plaintext: token,
    }
  );

  if (error) {
    console.error(
      '[orders] issue access token',
      error.message.replace(token, '[redacted]').slice(0, 160)
    );
    if (/ff_kiosk_issue_order_access_token|does not exist|schema cache/i.test(error.message)) {
      return {
        ok: false,
        error: 'El QR seguro de pedido aún no está disponible (migración 105).',
      };
    }
    return { ok: false, error: 'No se ha podido generar el enlace del pedido.' };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload && 'status' in payload ? String(payload.status) : '';
  if (status !== 'ok') {
    return { ok: false, error: 'No se ha podido generar el enlace del pedido.' };
  }

  return {
    ok: true,
    url: orderAccessPublicUrl(token),
    expiresAt: String(payload!.expires_at ?? ''),
  };
}

export type PublicOrderByToken =
  | {
      ok: true;
      order: {
        displayNumber: string;
        orderStatus: string;
        paymentStatus: string;
        totalAmount: number;
        currency: string;
        pharmacyName: string;
        createdAt: string;
        items: Array<{
          productName: string;
          quantity: number;
          unitPrice: number;
          lineTotal: number;
        }>;
      };
    }
  | { ok: false; error: string };

export async function getOrderByAccessToken(
  token: string
): Promise<PublicOrderByToken> {
  const plain = token.trim();
  if (!plain || plain.length < 43) {
    return { ok: false, error: 'Enlace no válido.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_get_order_by_access_token_v1', {
    p_token_plaintext: plain,
  });

  if (error) {
    console.error('[orders] get by access token', error.message.slice(0, 160));
    return { ok: false, error: 'No se ha podido cargar el pedido.' };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status === 'expired') {
    return { ok: false, error: 'Este enlace ha caducado.' };
  }
  if (status !== 'ok' || !payload?.order) {
    return { ok: false, error: 'Enlace no disponible.' };
  }

  const order = payload.order as Record<string, unknown>;
  const itemsRaw = Array.isArray(order.items) ? order.items : [];

  return {
    ok: true,
    order: {
      displayNumber: String(order.display_number),
      orderStatus: String(order.order_status),
      paymentStatus: String(order.payment_status),
      totalAmount: Number(order.total_amount),
      currency: String(order.currency ?? 'EUR'),
      pharmacyName: String(order.pharmacy_name ?? 'Farmacia'),
      createdAt: String(order.created_at ?? ''),
      items: itemsRaw.map((raw) => {
        const item = raw as Record<string, unknown>;
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
