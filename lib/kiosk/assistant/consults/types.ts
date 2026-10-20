export type PharmacistConsultChannel = 'kiosk' | 'customer_portal';

export type PharmacistConsultStatus =
  | 'pending'
  | 'answered'
  | 'resolved'
  | 'expired';

export type PharmacistConsultSummary = {
  id: string;
  pharmacyId: string;
  channel: PharmacistConsultChannel;
  displayCode: string;
  clientMessage: string;
  status: PharmacistConsultStatus;
  pharmacistReply: string | null;
  answeredAt: string | null;
  resolvedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type KioskConsultCreated = {
  id: string;
  displayCode: string;
  status: PharmacistConsultStatus;
  expiresAt: string;
};

export type KioskConsultPoll = {
  id: string;
  displayCode: string;
  status: PharmacistConsultStatus;
  reply: string | null;
  expiresAt: string;
  late: boolean;
};

/** Ventana de entrega al kiosko (espejo SQL). */
export const CONSULT_KIOSK_TTL_MS = 2 * 60 * 60 * 1000;
/** Retención dashboard en pruebas (espejo SQL: 7 días). Política definitiva pendiente. */
export const CONSULT_RETENTION_DAYS = 7;
export const CONSULT_CLIENT_MESSAGE_MAX = 500;
export const CONSULT_REPLY_MAX = 2000;
export const CONSULT_KIOSK_POLL_MS = 5_000;
export const CONSULT_DASHBOARD_POLL_MS = 12_000;
