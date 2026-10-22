/**
 * Gate comercial para solicitudes del catálogo público QR (espejo draft 057).
 * Independiente del módulo kiosk / ff_kiosk_pharmacy_runtime_allowed.
 */

export type PublicCatalogRequestGateInput = {
  pharmacyOperable: boolean;
  /** Módulo entrypoint_qr activo (Piloto/General lo incluyen). */
  hasEntrypointQr: boolean;
  /** Módulo orders activo — permiso comercial para recibir solicitudes. */
  hasOrders: boolean;
  /** Entitlement kiosk: NO requerido. */
  hasKiosk?: boolean;
};

export type PublicCatalogRequestGateResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'pharmacy_unavailable'
        | 'public_catalog_disabled'
        | 'orders_not_entitled';
    };

/**
 * ¿Puede la farmacia recibir solicitudes desde el QR público?
 * NO exige kiosk.
 */
export function gatePublicCatalogRequest(
  input: PublicCatalogRequestGateInput
): PublicCatalogRequestGateResult {
  if (!input.pharmacyOperable) {
    return { ok: false, code: 'pharmacy_unavailable' };
  }
  if (!input.hasEntrypointQr) {
    return { ok: false, code: 'public_catalog_disabled' };
  }
  if (!input.hasOrders) {
    return { ok: false, code: 'orders_not_entitled' };
  }
  // hasKiosk se ignora deliberadamente.
  return { ok: true };
}

/** Planes que reciben solicitudes públicas sin cuenta ni kiosk. */
export function planAllowsGuestPublicCatalogRequests(
  planCode: 'piloto' | 'general' | 'personalized' | 'ai_personalized' | string
): boolean {
  return planCode === 'piloto' || planCode === 'general';
}

/**
 * Representación de una solicitud genérica recién creada.
 * Nunca debe interpretarse como venta gratuita (waived) ni precio final.
 */
export function describePublicQrRequestPricing(input: {
  source: string;
  paymentStatus: string;
  orderStatus: string;
  totalAmount: number;
  catalogMode: 'generic' | 'own';
}): {
  isPendingConfirmation: boolean;
  isFreeSale: boolean;
  dashboardLabel: string;
  showEuroTotal: boolean;
} {
  const isPublicQr = input.source === 'public_qr';
  const isPendingConfirmation =
    isPublicQr &&
    (input.paymentStatus === 'pending_confirmation' ||
      input.orderStatus === 'request_pending');

  const isFreeSale =
    isPublicQr &&
    input.paymentStatus === 'waived' &&
    input.totalAmount <= 0;

  return {
    isPendingConfirmation,
    // Una solicitud genérica con total sentinel 0 + pending_confirmation NO es venta gratuita.
    isFreeSale: isFreeSale && !isPendingConfirmation,
    dashboardLabel: isPendingConfirmation
      ? 'Precio y disponibilidad pendientes de confirmar'
      : '',
    showEuroTotal:
      !isPendingConfirmation &&
      !(input.catalogMode === 'generic' && input.totalAmount <= 0),
  };
}
