/**
 * Estados de presupuesto public_qr para dashboard (R4).
 * Espejo de reglas SQL 062; pure / testeable.
 */

export const QUOTE_BUDGET_STATUSES = [
  'pending_valuation',
  'pending_acceptance',
  'accepted',
  'rejected',
  'expired',
  'legacy',
  'not_applicable',
] as const;

export type QuoteBudgetStatus = (typeof QUOTE_BUDGET_STATUSES)[number];

export const QUOTE_BUDGET_STATUS_LABELS: Record<QuoteBudgetStatus, string> = {
  pending_valuation: 'Pendiente de valoración',
  pending_acceptance: 'Pendiente de aceptación',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Caducado',
  legacy: 'Histórico (total)',
  not_applicable: '—',
};

export function deriveQuoteBudgetStatus(input: {
  source: string;
  quoteLegacyTotalOnly?: boolean | null;
  linesValuedAt: string | null;
  customerAcceptedAt: string | null;
  customerRejectedAt?: string | null;
  quoteExpiresAt?: string | null;
  nowMs?: number;
}): QuoteBudgetStatus {
  if (input.source !== 'public_qr') return 'not_applicable';
  if (input.quoteLegacyTotalOnly === true) return 'legacy';

  if (input.customerRejectedAt) return 'rejected';
  if (input.customerAcceptedAt) return 'accepted';

  if (!input.linesValuedAt) return 'pending_valuation';

  const now = input.nowMs ?? Date.now();
  if (input.quoteExpiresAt) {
    const exp = Date.parse(input.quoteExpiresAt);
    if (Number.isFinite(exp) && exp <= now) return 'expired';
  }

  return 'pending_acceptance';
}

/** ¿Puede el staff emitir/copiar enlace? */
export function canIssueQuoteLink(input: {
  source: string;
  quoteLegacyTotalOnly?: boolean | null;
  linesValuedAt: string | null;
  customerAcceptedAt: string | null;
  customerRejectedAt?: string | null;
  quoteExpiresAt?: string | null;
  status: string;
  nowMs?: number;
}): boolean {
  if (input.source !== 'public_qr') return false;
  if (input.quoteLegacyTotalOnly === true) return false;
  if (!input.linesValuedAt) return false;
  if (input.customerAcceptedAt || input.customerRejectedAt) return false;
  if (input.status === 'cancelled' || input.status === 'delivered') return false;
  const derived = deriveQuoteBudgetStatus(input);
  return derived === 'pending_acceptance';
}

/** ¿Requiere flag de revisión explícita para valorar? */
export function valuationNeedsExplicitRevision(input: {
  source: string;
  customerAcceptedAt: string | null;
  status: string;
}): boolean {
  return (
    input.source === 'public_qr' &&
    input.customerAcceptedAt != null &&
    input.status === 'request_pending'
  );
}

export function valuationLockedByStatus(status: string): boolean {
  return status === 'preparing' || status === 'ready' || status === 'delivered';
}
