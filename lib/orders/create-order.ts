import { createClient } from '@/lib/supabase/server';
import { sha256Hex } from '@/lib/kiosk/crypto';
import {
  clearKioskSessionCookie,
  parseKioskSessionCookie,
  readKioskSessionCookie,
} from '@/lib/kiosk/session-cookie';
import { createOrderErrorMessage } from '@/lib/orders/cart-validation';
import type {
  CartLineInput,
  CreateOrderErrorCode,
  CreateOrderResult,
  OrderStatus,
  PaymentStatus,
} from '@/lib/orders/types';

function mapRpcStatusToCode(status: string): CreateOrderErrorCode {
  switch (status) {
    case 'session_invalid':
      return 'session_invalid';
    case 'session_revoked':
      return 'session_revoked';
    case 'commercially_blocked':
      return 'commercially_blocked';
    case 'empty_cart':
      return 'empty_cart';
    case 'invalid_cart':
    case 'invalid_total':
      return 'invalid_cart';
    case 'invalid_product':
      return 'invalid_product';
    case 'invalid_quantity':
      return 'invalid_quantity';
    case 'product_inactive':
      return 'product_inactive';
    case 'product_not_found':
      return 'product_not_found';
    case 'product_wrong_pharmacy':
      return 'product_wrong_pharmacy';
    case 'duplicate_product_in_cart':
      return 'duplicate_product_in_cart';
    case 'invalid_request':
      return 'invalid_request';
    default:
      return 'unavailable';
  }
}

/**
 * Crea un pedido desde el runtime kiosko (cookie de dispositivo).
 * El cliente solo envía productId + quantity (+ client_request_id).
 * Precios y pharmacy_id se resuelven en el servidor (RPC 040).
 */
export async function createKioskOrderFromCart(input: {
  lines: CartLineInput[];
  clientRequestId: string;
}): Promise<CreateOrderResult> {
  const raw = readKioskSessionCookie();
  const parsed = parseKioskSessionCookie(raw);
  if (!parsed) {
    return {
      ok: false,
      code: 'session_missing',
      message: createOrderErrorMessage('session_missing'),
    };
  }

  const requestId = input.clientRequestId?.trim() ?? '';
  if (!requestId || requestId.length > 128) {
    return {
      ok: false,
      code: 'invalid_request',
      message: createOrderErrorMessage('invalid_request'),
    };
  }

  if (!input.lines?.length) {
    return {
      ok: false,
      code: 'empty_cart',
      message: createOrderErrorMessage('empty_cart'),
    };
  }

  const payloadItems = input.lines.map((line) => ({
    product_id: line.productId,
    quantity: line.quantity,
    // Nunca enviar precio al RPC como fuente de verdad; si hay mismatch
    // se valida en capa TS antes (cart-validation) cuando hay catálogo local.
  }));

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_kiosk_create_order_v1', {
    p_credential_hash: sha256Hex(parsed.credential),
    p_items: payloadItems,
    p_client_request_id: requestId,
  });

  if (error) {
    console.error('[orders] create kiosk', error.message);
    if (
      error.code === '42883' ||
      error.message.toLowerCase().includes('does not exist')
    ) {
      return {
        ok: false,
        code: 'unavailable',
        message:
          'El sistema de pedidos aún no está disponible en la base de datos.',
      };
    }
    return {
      ok: false,
      code: 'unavailable',
      message: createOrderErrorMessage('unavailable'),
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status !== 'ok') {
    if (status === 'session_revoked' || status === 'session_invalid') {
      clearKioskSessionCookie();
    }
    const code = mapRpcStatusToCode(status);
    return {
      ok: false,
      code,
      message: createOrderErrorMessage(code),
    };
  }

  return {
    ok: true,
    idempotent: payload!.idempotent === true,
    orderId: String(payload!.order_id),
    pharmacyId: String(payload!.pharmacy_id),
    orderNumber: Number(payload!.order_number),
    displayNumber: String(payload!.display_number),
    status: String(payload!.order_status) as OrderStatus,
    paymentStatus: String(payload!.payment_status) as PaymentStatus,
    totalAmount: Number(payload!.total_amount),
    currency: String(payload!.currency ?? 'EUR'),
  };
}
