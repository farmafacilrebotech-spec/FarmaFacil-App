import { createClient } from '@/lib/supabase/server';
import { requireOrdersManage } from '@/lib/orders/authz';
import {
  assertOrderStatusTransition,
  assertPaymentStatusTransition,
} from '@/lib/orders/transitions';
import type { OrderStatus, PaymentStatus } from '@/lib/orders/types';

export type UpdateOrderStatusResult =
  | {
      ok: true;
      unchanged: boolean;
      orderId: string;
      status: OrderStatus;
      paymentStatus: PaymentStatus;
    }
  | { ok: false; error: string; code?: string };

/**
 * Actualiza el estado operativo. La transición válida se comprueba en TS
 * (feedback rápido) y de nuevo en SQL DEFINER.
 */
export async function updatePharmacyOrderStatus(input: {
  pharmacyId: string;
  orderId: string;
  newStatus: OrderStatus;
  /** Estado actual conocido (opcional; si se pasa, valida transición en TS). */
  currentStatus?: OrderStatus;
}): Promise<UpdateOrderStatusResult> {
  const auth = await requireOrdersManage(input.pharmacyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error, code: 'forbidden' };
  }

  if (input.currentStatus) {
    const gate = assertOrderStatusTransition(
      input.currentStatus,
      input.newStatus
    );
    if (!gate.ok) {
      return {
        ok: false,
        error: 'Transición de estado no permitida.',
        code: 'invalid_transition',
      };
    }
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_update_pharmacy_order_status_v1',
    {
      p_pharmacy_id: input.pharmacyId,
      p_order_id: input.orderId,
      p_new_status: input.newStatus,
    }
  );

  if (error) {
    console.error('[orders] update status', error.message);
    return { ok: false, error: 'No se ha podido actualizar el pedido.' };
  }

  return mapUpdatePayload(data);
}

export async function updatePharmacyOrderPaymentStatus(input: {
  pharmacyId: string;
  orderId: string;
  newPaymentStatus: PaymentStatus;
  currentPaymentStatus?: PaymentStatus;
}): Promise<UpdateOrderStatusResult> {
  const auth = await requireOrdersManage(input.pharmacyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error, code: 'forbidden' };
  }

  if (input.currentPaymentStatus) {
    const gate = assertPaymentStatusTransition(
      input.currentPaymentStatus,
      input.newPaymentStatus
    );
    if (!gate.ok) {
      return {
        ok: false,
        error: 'Transición de pago no permitida.',
        code: 'invalid_transition',
      };
    }
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_update_pharmacy_order_payment_status_v1',
    {
      p_pharmacy_id: input.pharmacyId,
      p_order_id: input.orderId,
      p_new_payment_status: input.newPaymentStatus,
    }
  );

  if (error) {
    console.error('[orders] update payment', error.message);
    return {
      ok: false,
      error: 'No se ha podido actualizar el estado de pago.',
    };
  }

  return mapUpdatePayload(data);
}

function mapUpdatePayload(data: unknown): UpdateOrderStatusResult {
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
    };
  }

  if (status === 'forbidden' || status === 'unauthenticated') {
    return {
      ok: false,
      error: 'No tienes permiso para gestionar este pedido.',
      code: 'forbidden',
    };
  }
  if (status === 'not_found') {
    return {
      ok: false,
      error: 'Pedido no encontrado en esta farmacia.',
      code: 'not_found',
    };
  }
  if (status === 'invalid_transition') {
    return {
      ok: false,
      error: 'Transición de estado no permitida.',
      code: 'invalid_transition',
    };
  }
  return { ok: false, error: 'No se ha podido actualizar el pedido.' };
}
