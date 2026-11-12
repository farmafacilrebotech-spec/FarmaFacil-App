/**
 * Estados de historial de envío. Aceptado por Resend ≠ entregado.
 */

export type EmailHistoryKind =
  | 'draft'
  | 'pending_send'
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
  bouncedAt?: string | null;
  deliveredAt?: string | null;
};

export function resolveEmailHistoryKind(
  input: DeliveryStatusInput
): EmailHistoryKind {
  const status = (input.status || '').toLowerCase();
  const provider = (input.providerStatus || '').toLowerCase();

  if (status === 'blocked') return 'blocked';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'failed') return 'error';
  if (status === 'queued') return 'pending_send';

  if (provider === 'bounced' || input.bouncedAt) return 'bounced';
  if (provider === 'delivered' || input.deliveredAt) return 'delivered';

  // sent + accepted (o sin provider_status) = aceptado por Resend, NO entregado
  if (status === 'sent') return 'accepted_by_provider';

  return 'pending_send';
}

export function emailHistoryLabel(
  kind: EmailHistoryKind,
  opts?: { dryRun?: boolean }
): string {
  const base =
    kind === 'draft'
      ? 'Borrador'
      : kind === 'pending_send'
        ? 'Pendiente de envío'
        : kind === 'accepted_by_provider'
          ? 'Enviado a Resend'
          : kind === 'delivered'
            ? 'Entregado'
            : kind === 'error'
              ? 'Error'
              : kind === 'bounced'
                ? 'Rebotado'
                : kind === 'blocked'
                  ? 'Bloqueado'
                  : kind === 'cancelled'
                    ? 'Cancelado'
                    : kind;
  if (opts?.dryRun && (kind === 'accepted_by_provider' || kind === 'pending_send')) {
    return `${base} (prueba)`;
  }
  return base;
}
