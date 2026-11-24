/**
 * Política FarmaFácil: el stock no es bloqueante.
 *
 * FarmaFácil no sustituye al programa de gestión de la farmacia.
 * Stock cero, NULL o desconocido no oculta productos ni impide pedidos.
 * No se muestran cantidades de stock al cliente ni mensajes de «agotado».
 *
 * Nota BD: `pharmacy_products.stock` es NOT NULL DEFAULT 0 (migración 020).
 * Un 0 en BD no implica «agotado» comercial; solo ausencia de dato gestionado.
 */

export const KIOSK_REQUEST_MAX_QTY = 99;

/** Mensajes aprobados hacia el cliente / kiosko. */
export const CLIENT_AVAILABILITY_COPY = {
  requestable: 'Disponible para solicitar.',
  pharmacyWillConfirm: 'Tu farmacia te confirmará cuándo puedes recogerlo.',
  genericConfirm: 'Confirmar disponibilidad en farmacia',
  genericUnavailable: 'No disponible como solicitud genérica',
} as const;

/**
 * Tope de unidades en carrito/solicitud. El inventario FarmaFácil no limita.
 */
export function requestMaxQuantity(
  _stock?: number | null
): number {
  return KIOSK_REQUEST_MAX_QTY;
}

/**
 * Un producto propio publicable (activo) es solicitabile con independencia del stock.
 */
export function isStockBlockingAvailability(
  _stock: number | null | undefined
): boolean {
  return false;
}

/** Copy de disponibilidad para superficies comerciales (sin cantidades). */
export function formatClientAvailabilityMessage(options?: {
  generic?: boolean;
  unavailable?: boolean;
}): string {
  if (options?.unavailable) {
    return CLIENT_AVAILABILITY_COPY.genericUnavailable;
  }
  if (options?.generic) {
    return CLIENT_AVAILABILITY_COPY.genericConfirm;
  }
  return CLIENT_AVAILABILITY_COPY.requestable;
}
