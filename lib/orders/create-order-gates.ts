/**
 * Gates de creación / autorización testeables (espejo decisiones SQL/TS).
 */

import type { CreateOrderErrorCode } from '@/lib/orders/types';

export type KioskSessionGate =
  | { ok: true }
  | { ok: false; code: CreateOrderErrorCode };

/** Resultado de validar sesión de dispositivo antes de crear pedido. */
export function gateKioskSessionForOrder(input: {
  hasCookie: boolean;
  sessionStatus:
    | 'valid'
    | 'missing'
    | 'invalid'
    | 'revoked'
    | 'commercially_blocked';
}): KioskSessionGate {
  if (!input.hasCookie || input.sessionStatus === 'missing') {
    return { ok: false, code: 'session_missing' };
  }
  if (input.sessionStatus === 'revoked') {
    return { ok: false, code: 'session_revoked' };
  }
  if (input.sessionStatus === 'invalid') {
    return { ok: false, code: 'session_invalid' };
  }
  if (input.sessionStatus === 'commercially_blocked') {
    return { ok: false, code: 'commercially_blocked' };
  }
  return { ok: true };
}

/**
 * ¿Puede el staff gestionar pedidos de esta farmacia?
 * Platform write O (membership active + orders.manage).
 */
export function canManagePharmacyOrders(input: {
  isAuthenticated: boolean;
  hasPlatformWrite: boolean;
  isActiveMember: boolean;
  hasOrdersManage: boolean;
}): { ok: true } | { ok: false; code: 'unauthenticated' | 'forbidden' } {
  if (!input.isAuthenticated) {
    return { ok: false, code: 'unauthenticated' };
  }
  if (input.hasPlatformWrite) {
    return { ok: true };
  }
  if (input.isActiveMember && input.hasOrdersManage) {
    return { ok: true };
  }
  return { ok: false, code: 'forbidden' };
}

/**
 * Contrato de idempotencia: mismo pharmacy + client_request_id → mismo pedido.
 */
export function resolveIdempotentCreate(input: {
  existingOrderId: string | null;
  newOrderId: string;
}): { orderId: string; idempotent: boolean } {
  if (input.existingOrderId) {
    return { orderId: input.existingOrderId, idempotent: true };
  }
  return { orderId: input.newOrderId, idempotent: false };
}
