/**
 * npm run test:orders
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canManagePharmacyOrders,
  gateKioskSessionForOrder,
  resolveIdempotentCreate,
} from './create-order-gates.ts';

describe('gateKioskSessionForOrder', () => {
  it('permite sesión válida', () => {
    assert.deepEqual(
      gateKioskSessionForOrder({
        hasCookie: true,
        sessionStatus: 'valid',
      }),
      { ok: true }
    );
  });

  it('bloquea sesión revocada', () => {
    assert.deepEqual(
      gateKioskSessionForOrder({
        hasCookie: true,
        sessionStatus: 'revoked',
      }),
      { ok: false, code: 'session_revoked' }
    );
  });

  it('bloquea cookie ausente o inválida', () => {
    assert.equal(
      gateKioskSessionForOrder({
        hasCookie: false,
        sessionStatus: 'missing',
      }).ok,
      false
    );
    assert.deepEqual(
      gateKioskSessionForOrder({
        hasCookie: true,
        sessionStatus: 'invalid',
      }),
      { ok: false, code: 'session_invalid' }
    );
  });
});

describe('pedido duplicado (idempotencia)', () => {
  it('repite client_request_id → mismo orderId, idempotent=true', () => {
    const first = resolveIdempotentCreate({
      existingOrderId: null,
      newOrderId: 'order-1',
    });
    assert.deepEqual(first, { orderId: 'order-1', idempotent: false });

    const retry = resolveIdempotentCreate({
      existingOrderId: 'order-1',
      newOrderId: 'order-should-not-use',
    });
    assert.deepEqual(retry, { orderId: 'order-1', idempotent: true });
  });
});

describe('canManagePharmacyOrders — usuario sin permisos', () => {
  it('rechaza sin autenticación', () => {
    assert.deepEqual(
      canManagePharmacyOrders({
        isAuthenticated: false,
        hasPlatformWrite: false,
        isActiveMember: false,
        hasOrdersManage: false,
      }),
      { ok: false, code: 'unauthenticated' }
    );
  });

  it('rechaza miembro sin orders.manage', () => {
    assert.deepEqual(
      canManagePharmacyOrders({
        isAuthenticated: true,
        hasPlatformWrite: false,
        isActiveMember: true,
        hasOrdersManage: false,
      }),
      { ok: false, code: 'forbidden' }
    );
  });

  it('rechaza no miembro aunque diga tener permiso', () => {
    assert.deepEqual(
      canManagePharmacyOrders({
        isAuthenticated: true,
        hasPlatformWrite: false,
        isActiveMember: false,
        hasOrdersManage: true,
      }),
      { ok: false, code: 'forbidden' }
    );
  });

  it('permite miembro con orders.manage o platform write', () => {
    assert.equal(
      canManagePharmacyOrders({
        isAuthenticated: true,
        hasPlatformWrite: false,
        isActiveMember: true,
        hasOrdersManage: true,
      }).ok,
      true
    );
    assert.equal(
      canManagePharmacyOrders({
        isAuthenticated: true,
        hasPlatformWrite: true,
        isActiveMember: false,
        hasOrdersManage: false,
      }).ok,
      true
    );
  });
});
