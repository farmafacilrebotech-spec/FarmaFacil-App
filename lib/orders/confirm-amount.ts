import { createClient } from '@/lib/supabase/server';
import { requireOrdersManage } from '@/lib/orders/authz';
import { parseConfirmableEuroAmount } from '@/lib/orders/euro-amount';
import { getPharmacyOrderDetail } from '@/lib/orders/queries';
import type { OrderStatus, PaymentStatus } from '@/lib/orders/types';

export { parseConfirmableEuroAmount } from '@/lib/orders/euro-amount';

export type ConfirmOrderAmountResult =
  | {
      ok: true;
      unchanged: boolean;
      orderId: string;
      status: OrderStatus;
      paymentStatus: PaymentStatus;
      totalAmount: number;
      amountConfirmedAt: string;
      amountConfirmed: true;
    }
  | { ok: false; error: string; code?: string };

/**
 * Confirma el importe total vía RPC 058 (no public_qr tras 060).
 * Tras OK: payment suele ser unpaid (sin cobrar).
 */
export async function confirmPharmacyOrderAmount(input: {
  pharmacyId: string;
  orderId: string;
  amount: number;
}): Promise<ConfirmOrderAmountResult> {
  const auth = await requireOrdersManage(input.pharmacyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error, code: 'forbidden' };
  }

  const detail = await getPharmacyOrderDetail(input.pharmacyId, input.orderId);
  if (!detail.ok) {
    return { ok: false, error: detail.error, code: detail.reason ?? 'not_found' };
  }
  if (detail.order.source === 'public_qr') {
    return {
      ok: false,
      error:
        'Las solicitudes del catálogo QR deben valorarse por producto (no por total libre).',
      code: 'use_line_valuation',
    };
  }

  const parsed = parseConfirmableEuroAmount(input.amount);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, code: 'invalid_amount' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_confirm_pharmacy_order_amount_v1',
    {
      p_pharmacy_id: input.pharmacyId,
      p_order_id: input.orderId,
      p_amount: parsed.amount,
    }
  );

  if (error) {
    console.error('[orders] confirm amount', error.message);
    return { ok: false, error: 'No se ha podido confirmar el importe.' };
  }

  return mapConfirmPayload(data);
}

function mapConfirmPayload(data: unknown): ConfirmOrderAmountResult {
  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload && 'status' in payload ? String(payload.status) : '';

  if (status === 'ok') {
    return {
      ok: true,
      unchanged: payload!.unchanged === true,
      orderId: String(payload!.order_id),
      status: String(payload!.order_status) as OrderStatus,
      paymentStatus: String(payload!.payment_status) as PaymentStatus,
      totalAmount: Number(payload!.total_amount),
      amountConfirmedAt: String(payload!.amount_confirmed_at),
      amountConfirmed: true,
    };
  }

  const errors: Record<string, string> = {
    unauthenticated: 'Debes iniciar sesión.',
    forbidden: 'No tienes permiso para confirmar importes de este pedido.',
    not_found: 'Pedido no encontrado en esta farmacia.',
    invalid_request: 'Datos de confirmación no válidos.',
    invalid_amount: 'El importe no es válido.',
    order_cancelled: 'No se puede confirmar el importe de un pedido cancelado.',
    order_delivered:
      'No se puede modificar el importe de un pedido ya entregado.',
    invalid_order_status:
      'Este estado del pedido no admite confirmar o cambiar el importe.',
    already_paid:
      'El pedido ya está marcado como cobrado; no se puede cambiar el importe aquí.',
    refunded: 'No se puede confirmar importe en un pedido reembolsado.',
    use_line_valuation:
      'Las solicitudes del catálogo QR deben valorarse por producto.',
  };

  return {
    ok: false,
    error: errors[status] ?? 'No se ha podido confirmar el importe.',
    code: status || 'error',
  };
}
