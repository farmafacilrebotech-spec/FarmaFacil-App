import type { OrderStatus, PaymentStatus } from './types';

export type ConfirmLineValuationResult =
  | {
      ok: true;
      unchanged: boolean;
      orderId: string;
      status: OrderStatus;
      paymentStatus: PaymentStatus;
      totalAmount: number;
      amountConfirmedAt: string;
      linesValuedAt: string;
      customerAcceptedAt: string | null;
      awaitingCustomerAcceptance: boolean;
      availableCount: number;
      /** ISO; presente si la RPC lo devuelve (sync concurrencia). */
      updatedAt: string | null;
      quoteVersion?: number | null;
      quoteExpiresAt?: string | null;
    }
  | { ok: false; error: string; code?: string };

function parseRpcPayload(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
}

/** Mapeo de respuesta RPC → resultado de acción (puro / testeable). */
export function mapPublicQrLineValuationPayload(
  data: unknown
): ConfirmLineValuationResult {
  const payload = parseRpcPayload(data);
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status === 'ok') {
    const updatedRaw = payload!.updated_at;
    return {
      ok: true,
      unchanged: payload!.unchanged === true,
      orderId: String(payload!.order_id),
      status: String(payload!.order_status) as OrderStatus,
      paymentStatus: String(payload!.payment_status) as PaymentStatus,
      totalAmount: Number(payload!.total_amount),
      amountConfirmedAt: String(payload!.amount_confirmed_at),
      linesValuedAt: String(payload!.lines_valued_at),
      customerAcceptedAt:
        payload!.customer_accepted_at == null
          ? null
          : String(payload!.customer_accepted_at),
      awaitingCustomerAcceptance:
        payload!.awaiting_customer_acceptance === true,
      availableCount: Number(payload!.available_lines ?? 0),
      updatedAt:
        updatedRaw == null || updatedRaw === '' ? null : String(updatedRaw),
      quoteVersion:
        payload!.quote_version == null
          ? null
          : Number(payload!.quote_version),
      quoteExpiresAt:
        payload!.quote_expires_at == null
          ? null
          : String(payload!.quote_expires_at),
    };
  }

  const errors: Record<string, string> = {
    unauthenticated: 'Debes iniciar sesión.',
    forbidden: 'No tienes permiso para valorar este pedido.',
    not_found: 'Pedido no encontrado en esta farmacia.',
    not_public_qr: 'Este pedido no es una solicitud del catálogo QR.',
    order_cancelled: 'El pedido está cancelado.',
    order_delivered: 'El pedido ya está entregado.',
    already_paid: 'El pedido ya está cobrado.',
    refunded: 'El pedido está reembolsado.',
    concurrent_modification:
      'El pedido cambió mientras lo editabas. Se han recargado los datos actuales; revísalos antes de guardar de nuevo.',
    invalid_lines: 'Revisa disponibilidad y precios de todas las líneas.',
    invalid_amount: 'Hay un precio unitario no válido.',
    invalid_note: 'Hay una observación no válida.',
    invalid_quantity: 'Hay una cantidad no válida.',
    empty_order: 'El pedido no tiene líneas.',
    invalid_order_status:
      'Este estado del pedido no admite valoración por línea.',
    invalid_payment_status:
      'Este estado de pago no admite valoración por línea.',
    invalid_request: 'Solicitud de valoración no válida.',
    legacy_total_only:
      'Los pedidos históricos de total único no admiten valoración por línea.',
    valuation_locked:
      'No se puede revalorar: el pedido ya está en preparación o listo.',
    revision_required:
      'El presupuesto ya fue aceptado. Confirma una revisión explícita para cambiar precios.',
  };

  if (status in errors) {
    return { ok: false, error: errors[status], code: status };
  }
  return {
    ok: false,
    error: 'No se ha podido confirmar la valoración.',
    code: status || 'unknown',
  };
}
