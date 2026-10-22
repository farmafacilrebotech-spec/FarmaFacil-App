import { createClient } from '@/lib/supabase/server';
import {
  mapPublicRequestRpcStatus,
  publicRequestErrorMessage,
  validatePublicCatalogRequestInput,
  type PublicRequestContactInput,
  type PublicRequestErrorCode,
  type PublicRequestLineInput,
} from '@/lib/kiosk/public-catalog-request-validation';

export type CreatePublicCatalogRequestOk = {
  ok: true;
  idempotent: boolean;
  displayNumber: string;
  orderNumber: number;
  pharmacyName: string;
  catalogMode: string;
  totalAmount: number;
  currency: string;
  orderStatus: string;
  paymentStatus: string;
  /** true = no presentar total como precio final ni venta gratuita. */
  pricingPending: boolean;
};

export type CreatePublicCatalogRequestResult =
  | CreatePublicCatalogRequestOk
  | { ok: false; code: PublicRequestErrorCode; message: string };

/**
 * Crea una solicitud desde el catálogo público QR.
 * pharmacy_id se resuelve solo en el RPC a partir de publicId.
 * No registra nombre ni teléfono en logs.
 */
export async function createPublicCatalogRequest(input: {
  publicId: string;
  clientRequestId: string;
  lines: PublicRequestLineInput[];
  contact: PublicRequestContactInput;
}): Promise<CreatePublicCatalogRequestResult> {
  const validated = validatePublicCatalogRequestInput(input);
  if (!validated.ok) {
    return validated;
  }

  const payloadItems = validated.lines.map((line) => ({
    product_id: line.productId,
    quantity: line.quantity,
  }));

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_public_catalog_create_request_v1',
    {
      p_public_id: validated.publicId,
      p_items: payloadItems,
      p_client_request_id: validated.clientRequestId,
      p_customer_name: validated.customerName,
      p_customer_phone: validated.customerPhone,
      p_privacy_accepted: true,
      p_customer_note: validated.customerNote,
    }
  );

  if (error) {
    // Sin PII (nombre/teléfono) en logs.
    const pgCode =
      typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: string }).code ?? '')
        : '';
    const msg = (error.message ?? '').toLowerCase();
    console.error('[public-catalog-request]', pgCode || 'rpc_error');

    if (
      pgCode === '42883' ||
      msg.includes('does not exist')
    ) {
      return {
        ok: false,
        code: 'unavailable',
        message:
          'Las solicitudes del catálogo aún no están disponibles (falta migración 057).',
      };
    }
    // Contador de pedidos desincronizado / carrera de número (23505 unique_violation).
    if (
      pgCode === '23505' ||
      msg.includes('pharmacy_orders_pharmacy_order_number_uid') ||
      msg.includes('duplicate key')
    ) {
      return {
        ok: false,
        code: 'unavailable',
        message:
          'No se ha podido completar la solicitud por un conflicto temporal. Espera un momento e inténtalo de nuevo.',
      };
    }
    return {
      ok: false,
      code: 'unavailable',
      message: publicRequestErrorMessage('unavailable'),
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  const status = payload ? String(payload.status ?? '') : '';

  if (status !== 'ok' || !payload) {
    const code = mapPublicRequestRpcStatus(status || 'unavailable');
    return {
      ok: false,
      code,
      message: publicRequestErrorMessage(code),
    };
  }

  const paymentStatus = String(
    payload.payment_status ?? 'pending_confirmation'
  );
  const pricingPending =
    payload.pricing_pending === true ||
    paymentStatus === 'pending_confirmation';

  return {
    ok: true,
    idempotent: payload.idempotent === true,
    displayNumber: String(payload.display_number ?? ''),
    orderNumber: Number(payload.order_number ?? 0),
    pharmacyName: String(payload.pharmacy_name ?? ''),
    catalogMode: String(payload.catalog_mode ?? ''),
    totalAmount:
      typeof payload.total_amount === 'string'
        ? Number(payload.total_amount)
        : Number(payload.total_amount ?? 0),
    currency: String(payload.currency ?? 'EUR'),
    orderStatus: String(payload.order_status ?? 'request_pending'),
    paymentStatus,
    pricingPending,
  };
}
