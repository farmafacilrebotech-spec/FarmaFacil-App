export const PHARMACY_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  pending_contract: 'Pendiente de contrato',
  contract_sent: 'Contrato enviado',
  contract_signed: 'Contrato firmado',
  pending_setup: 'Pendiente de configuración',
  active: 'Activa',
  suspended: 'Suspendida',
  archived: 'Archivada',
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  trialing: 'Periodo de prueba',
  active: 'Activa',
  past_due: 'Pago atrasado',
  paused: 'Pausada',
  cancelled: 'Cancelada',
  expired: 'Expirada',
};

export const DEFAULT_PRIMARY_COLOR = '#2EC4C7';
export const DEFAULT_SECONDARY_COLOR = '#0EA5E9';

export const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  invited: 'Invitado',
  active: 'Activo',
  suspended: 'Suspendido',
  revoked: 'Revocado',
};
