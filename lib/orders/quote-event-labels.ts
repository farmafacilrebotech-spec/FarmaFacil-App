/** Labels / tipos de eventos de presupuesto (pure; sin I/O). */

export const QUOTE_EVENT_TYPES = [
  'version_created',
  'token_issued',
  'token_revoked',
  'accepted',
  'rejected',
  'invalidated_by_revaluation',
  'revision_started',
] as const;

export type QuoteEventType = (typeof QUOTE_EVENT_TYPES)[number];

export const QUOTE_EVENT_TYPE_LABELS: Record<string, string> = {
  version_created: 'Nueva versión',
  token_issued: 'Enlace emitido',
  token_revoked: 'Enlace invalidado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  invalidated_by_revaluation: 'Invalidado por revaloración',
  revision_started: 'Revisión iniciada',
};
