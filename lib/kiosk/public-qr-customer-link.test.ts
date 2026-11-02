import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPublicQrCheckoutPrefill,
  publicQrOrderLinkDefault,
  publicQrOrderLinkSource,
  shouldLinkPublicQrOrder,
  shouldLinkPublicQrOrderToSession,
} from './public-qr-customer-link.ts';

describe('public QR customer link (072)', () => {
  it('sesión customer|both puede vincular; staff e invitado no', () => {
    assert.equal(shouldLinkPublicQrOrderToSession('customer'), true);
    assert.equal(shouldLinkPublicQrOrderToSession('both'), true);
    assert.equal(shouldLinkPublicQrOrderToSession('staff'), false);
    assert.equal(shouldLinkPublicQrOrderToSession(null), false);
  });

  it('vínculo solo con opt-in explícito + kind válido', () => {
    assert.equal(
      shouldLinkPublicQrOrder({
        accountKind: 'customer',
        linkToCustomerRequested: true,
      }),
      true
    );
    assert.equal(
      shouldLinkPublicQrOrder({
        accountKind: 'both',
        linkToCustomerRequested: true,
      }),
      true
    );
    assert.equal(
      shouldLinkPublicQrOrder({
        accountKind: 'customer',
        linkToCustomerRequested: false,
      }),
      false
    );
    assert.equal(
      shouldLinkPublicQrOrder({
        accountKind: 'staff',
        linkToCustomerRequested: true,
      }),
      false
    );
    assert.equal(
      shouldLinkPublicQrOrder({
        accountKind: null,
        linkToCustomerRequested: true,
      }),
      false
    );
  });

  it('default RPC sin vínculo; fuente solo auth.uid en servidor', () => {
    assert.equal(publicQrOrderLinkDefault(), false);
    assert.equal(publicQrOrderLinkSource(), 'auth.uid_server_only');
  });

  it('prefill editable desde perfil sin inventar teléfono', () => {
    const prefill = buildPublicQrCheckoutPrefill({
      firstName: 'Ana',
      lastName: 'García',
      fullName: 'Ana García',
      phone: '612345678',
      email: 'ana@example.com',
      privacyAcceptedAt: '2026-01-01T00:00:00Z',
    });
    assert.equal(prefill.displayName, 'Ana García');
    assert.equal(prefill.phone, '612345678');
    assert.equal(prefill.privacyAlreadyAccepted, true);
  });

  it('edición de pedido no implica escritura de perfil (contrato UI)', () => {
    const prefill = buildPublicQrCheckoutPrefill({
      firstName: 'Ana',
      lastName: null,
      fullName: null,
      phone: '612345678',
      email: null,
      privacyAcceptedAt: null,
    });
    prefill.displayName = 'Nombre del pedido';
    prefill.phone = '699000000';
    assert.equal(prefill.displayName, 'Nombre del pedido');
    assert.equal(prefill.privacyAlreadyAccepted, false);
  });
});
