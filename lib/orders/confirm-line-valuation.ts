import { createClient } from '@/lib/supabase/server';
import { requireOrdersManage } from '@/lib/orders/authz';
import {
  mapPublicQrLineValuationPayload,
  type ConfirmLineValuationResult,
} from '@/lib/orders/confirm-line-valuation-map';
import {
  validatePublicQrLineValuation,
  type ValuationLineInput,
} from '@/lib/orders/line-valuation';
import { getPharmacyOrderDetail } from '@/lib/orders/queries';

export type { ConfirmLineValuationResult };
export { mapPublicQrLineValuationPayload } from '@/lib/orders/confirm-line-valuation-map';

/**
 * Confirma valoración por línea vía RPC 060.
 * El total lo calcula el servidor; aquí solo validamos forma antes del RPC.
 */
export async function confirmPublicQrLineValuation(input: {
  pharmacyId: string;
  orderId: string;
  lines: ValuationLineInput[];
  expectedUpdatedAt?: string | null;
  /** R4: revisión explícita tras aceptación (antes de preparación). */
  allowRevision?: boolean;
}): Promise<ConfirmLineValuationResult> {
  const auth = await requireOrdersManage(input.pharmacyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error, code: 'forbidden' };
  }

  const detail = await getPharmacyOrderDetail(input.pharmacyId, input.orderId);
  if (!detail.ok) {
    return { ok: false, error: detail.error, code: detail.reason ?? 'not_found' };
  }

  if (detail.order.source !== 'public_qr') {
    return {
      ok: false,
      error: 'La valoración por línea solo aplica a solicitudes del catálogo QR.',
      code: 'not_public_qr',
    };
  }

  const validated = validatePublicQrLineValuation({
    existingLines: detail.order.items.map((i) => ({
      itemId: i.id,
      quantity: i.quantity,
    })),
    submitted: input.lines,
  });

  if (!validated.ok) {
    return {
      ok: false,
      error: validated.message,
      code: validated.code,
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_confirm_public_qr_line_valuation_v1',
    {
      p_pharmacy_id: input.pharmacyId,
      p_order_id: input.orderId,
      p_lines: validated.lines.map((l) => ({
        item_id: l.itemId,
        availability: l.availability,
        unit_price: l.unitPrice,
        staff_note: l.staffNote,
      })),
      p_expected_updated_at: input.expectedUpdatedAt ?? null,
      p_allow_revision: input.allowRevision === true,
    }
  );

  if (error) {
    console.error('[orders] line valuation', error.message);
    if (
      /ff_confirm_public_qr_line_valuation|does not exist|schema cache/i.test(
        error.message
      )
    ) {
      return {
        ok: false,
        error:
          'La valoración por línea aún no está disponible en esta base de datos (migración 060 pendiente).',
        code: 'rpc_unavailable',
      };
    }
    return {
      ok: false,
      error: 'No se ha podido confirmar la valoración.',
      code: 'network_error',
    };
  }

  return mapPublicQrLineValuationPayload(data);
}
