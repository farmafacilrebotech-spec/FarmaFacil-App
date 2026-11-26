/**
 * Semántica de precios de catálogo (kiosko, QR, panel).
 *
 * Importante: en BD `pharmacy_products.price` es NOT NULL DEFAULT 0.
 * Un 0 técnico NO implica producto gratuito — se trata como precio no informado
 * salvo que exista una señal explícita de gratuidad (hoy no hay flag).
 */

export const PRICE_COPY = {
  consultPrice: 'Consultar precio',
  pendingValuation: 'Pendiente de valoración',
  valuedSubtotal: 'Subtotal valorado',
  definitivePending: 'Importe definitivo pendiente de confirmar',
  free: 'Gratis',
} as const;

export type PricePresence = 'informed' | 'pending' | 'free';

/**
 * Interpreta un precio numérico/nullable de catálogo.
 * - null / undefined / NaN / < 0 → pending
 * - exactamente 0 → pending (no gratuito implícito)
 * - > 0 → informed
 */
export function classifyCatalogPrice(
  price: number | null | undefined
): PricePresence {
  if (price == null || !Number.isFinite(price) || price < 0) return 'pending';
  if (price === 0) return 'pending';
  return 'informed';
}

export function isPriceInformed(price: number | null | undefined): boolean {
  return classifyCatalogPrice(price) === 'informed';
}

export function isPricePending(price: number | null | undefined): boolean {
  return classifyCatalogPrice(price) === 'pending';
}

function formatEuroLocal(amount: number): string {
  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} €`;
  }
}

/** Etiqueta de precio en catálogo (cliente). */
export function formatCatalogPriceLabel(
  price: number | null | undefined,
  opts?: { generic?: boolean }
): string {
  if (opts?.generic) return PRICE_COPY.consultPrice;
  if (isPricePending(price)) return PRICE_COPY.consultPrice;
  return formatEuroLocal(price as number);
}

/** Etiqueta en carrito / pedido / ticket. */
export function formatLinePriceLabel(
  price: number | null | undefined
): string {
  if (isPricePending(price)) return PRICE_COPY.pendingValuation;
  return formatEuroLocal(price as number);
}
