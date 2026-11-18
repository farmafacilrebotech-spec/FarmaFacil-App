/**
 * Implantaciones abonadas (190 € app / 1.090 € kiosko) y compensación en presupuesto.
 */

export const IMPLANTATION_CONCEPTS = {
  app_setup: {
    key: 'app_setup' as const,
    label: 'Implantación de la aplicación',
    defaultNetCents: 19_000,
  },
  kiosk_customization: {
    key: 'kiosk_customization' as const,
    label: 'Personalización del kiosko',
    defaultNetCents: 109_000,
  },
} as const;

export type ImplantationConcept = keyof typeof IMPLANTATION_CONCEPTS;

export type ImplantationPaymentRow = {
  id: string;
  pharmacyId: string;
  concept: ImplantationConcept;
  netCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  appliedCents: number;
  appliedToQuoteId: string | null;
  paymentStatus: string;
  paymentDate: string;
  documentRef: string | null;
};

/** Importe pendiente de compensar (no re-cobrar). */
export function implantationPendingCents(row: {
  amountPaidCents: number;
  appliedCents: number;
}): number {
  return Math.max(0, row.amountPaidCents - row.appliedCents);
}

/**
 * Compensa implantaciones en el pago inicial del presupuesto.
 * No trata el abono como descuento comercial genérico.
 */
export function applyImplantationCompensation(input: {
  initialNetCents: number;
  payments: Array<{ id: string; pendingCents: number }>;
}): {
  originalInitialNetCents: number;
  compensatedCents: number;
  pendingInitialNetCents: number;
  allocations: Array<{ paymentId: string; appliedCents: number }>;
} {
  let remaining = Math.max(0, input.initialNetCents);
  const allocations: Array<{ paymentId: string; appliedCents: number }> = [];
  let compensated = 0;
  for (const p of input.payments) {
    if (remaining <= 0) break;
    const use = Math.min(remaining, Math.max(0, p.pendingCents));
    if (use <= 0) continue;
    allocations.push({ paymentId: p.id, appliedCents: use });
    compensated += use;
    remaining -= use;
  }
  return {
    originalInitialNetCents: input.initialNetCents,
    compensatedCents: compensated,
    pendingInitialNetCents: remaining,
    allocations,
  };
}
