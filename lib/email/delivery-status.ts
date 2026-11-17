/**
 * Estados de historial de envío. Aceptado por Resend ≠ entregado.
 * Dry-run / simulación nunca se presenta como aceptación del proveedor.
 */

export type EmailHistoryKind =
  | 'draft'
  | 'pending_send'
  | 'simulated'
  | 'accepted_by_provider'
  | 'delivered'
  | 'error'
  | 'bounced'
  | 'blocked'
  | 'cancelled';

export type DeliveryStatusInput = {
  status: string;
  providerStatus?: string | null;
  dryRun?: boolean;
  providerMessageId?: string | null;
  bouncedAt?: string | null;
  deliveredAt?: string | null;
};

function looksLikeDryRunProviderId(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^dry-run-/i.test(id.trim());
}

export function resolveEmailHistoryKind(
  input: DeliveryStatusInput
): EmailHistoryKind {
  const status = (input.status || '').toLowerCase();
  const provider = (input.providerStatus || '').toLowerCase();
  const simulated =
    input.dryRun === true ||
    provider === 'simulated' ||
    looksLikeDryRunProviderId(input.providerMessageId);

  if (status === 'blocked') return 'blocked';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'failed') return 'error';
  if (status === 'queued') {
    return simulated ? 'simulated' : 'pending_send';
  }

  if (provider === 'bounced' || input.bouncedAt) return 'bounced';
  if (!simulated && (provider === 'delivered' || input.deliveredAt)) {
    return 'delivered';
  }

  // Simulación: nunca «aceptado por el proveedor»
  if (simulated && (status === 'sent' || status === 'queued' || !status)) {
    return 'simulated';
  }

  // sent + accepted (o sin provider_status) = aceptado por Resend, NO entregado
  if (status === 'sent') return 'accepted_by_provider';

  return 'pending_send';
}

export function emailHistoryLabel(
  kind: EmailHistoryKind,
  _opts?: { dryRun?: boolean }
): string {
  switch (kind) {
    case 'draft':
      return 'Borrador';
    case 'pending_send':
      return 'Pendiente de envío';
    case 'simulated':
      return 'Envío simulado';
    case 'accepted_by_provider':
      return 'Aceptado por el proveedor';
    case 'delivered':
      return 'Entregado';
    case 'error':
      return 'Error de envío';
    case 'bounced':
      return 'Rebotado';
    case 'blocked':
      return 'Bloqueado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return kind;
  }
}
