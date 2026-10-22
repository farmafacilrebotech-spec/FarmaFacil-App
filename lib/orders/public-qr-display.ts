/**
 * Presentación de solicitudes public_qr (sin I/O; testeable en Node strip-types).
 * El total técnico 0 no es precio ni venta gratuita.
 * amount_confirmed_at es la señal canónica (058): NOT NULL = confirmado (también 0 €).
 */

export function isPublicQrAmountPending(input: {
  amount: number;
  source: string;
  paymentStatus?: string | null;
  orderStatus?: string | null;
  /** ISO o null; undefined = columna aún no cargada (tratar como no confirmado). */
  amountConfirmedAt?: string | null;
}): boolean {
  if (input.source !== 'public_qr') return false;
  // amount_confirmed_at NOT NULL = confirmado (también 0 €). Sin timestamp = pendiente.
  return !input.amountConfirmedAt;
}

export function formatPublicQrOrEuroAmount(input: {
  amount: number;
  currency?: string;
  source: string;
  paymentStatus?: string | null;
  orderStatus?: string | null;
  amountConfirmedAt?: string | null;
  formatEuro: (amount: number, currency?: string) => string;
}): string {
  if (isPublicQrAmountPending(input)) {
    return 'Precio y disponibilidad pendientes de confirmar';
  }
  return input.formatEuro(input.amount, input.currency ?? 'EUR');
}

/** Oculta «paid» mientras el importe QR no está confirmado. */
export function filterPaymentOptionsForPublicQrAmount<T extends string>(
  options: readonly T[],
  input: {
    amount: number;
    source: string;
    paymentStatus?: string | null;
    orderStatus?: string | null;
    amountConfirmedAt?: string | null;
  }
): T[] {
  if (!isPublicQrAmountPending(input)) {
    return [...options];
  }
  return options.filter((p) => p !== 'paid');
}

/** Estados operativos en los que se puede confirmar/cambiar el importe. */
export function canConfirmOrderAmount(status: string): boolean {
  return (
    status === 'request_pending' ||
    status === 'preparing' ||
    status === 'ready'
  );
}
