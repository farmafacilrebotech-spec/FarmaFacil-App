import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  describePublicQrRequestPricing,
  gatePublicCatalogRequest,
  planAllowsGuestPublicCatalogRequests,
} from './public-catalog-request-gate.ts';
import {
  PUBLIC_QR_ORDER_STATUS,
  PUBLIC_QR_PAYMENT_STATUS,
  PUBLIC_REQUEST_MAX_QTY,
  PUBLIC_REQUEST_RATE_LIMIT_PER_HOUR,
  publicCatalogRequestAuthRequirements,
  validatePublicRequestLines,
} from './public-catalog-request-validation.ts';
import {
  isOrderStatusTransitionAllowed,
  isPaymentStatusTransitionAllowed,
} from '../orders/transitions.ts';

const PID_A = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const PID_B = 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('1–2) Piloto/General sin kiosk pueden recibir solicitudes QR', () => {
  it('Piloto operable + entrypoint_qr + orders, sin kiosk → ok', () => {
    const gate = gatePublicCatalogRequest({
      pharmacyOperable: true,
      hasEntrypointQr: true,
      hasOrders: true,
      hasKiosk: false,
    });
    assert.equal(gate.ok, true);
    assert.equal(planAllowsGuestPublicCatalogRequests('piloto'), true);
  });

  it('General operable + entrypoint_qr + orders, sin kiosk → ok', () => {
    const gate = gatePublicCatalogRequest({
      pharmacyOperable: true,
      hasEntrypointQr: true,
      hasOrders: true,
      hasKiosk: false,
    });
    assert.equal(gate.ok, true);
    assert.equal(planAllowsGuestPublicCatalogRequests('general'), true);
  });

  it('hasKiosk=true no cambia el resultado (no es requisito)', () => {
    const without = gatePublicCatalogRequest({
      pharmacyOperable: true,
      hasEntrypointQr: true,
      hasOrders: true,
      hasKiosk: false,
    });
    const withKiosk = gatePublicCatalogRequest({
      pharmacyOperable: true,
      hasEntrypointQr: true,
      hasOrders: true,
      hasKiosk: true,
    });
    assert.deepEqual(without, withKiosk);
  });
});

describe('3) Farmacia sin entitlement de pedidos no puede recibirlas', () => {
  it('sin módulo orders → orders_not_entitled', () => {
    const gate = gatePublicCatalogRequest({
      pharmacyOperable: true,
      hasEntrypointQr: true,
      hasOrders: false,
      hasKiosk: true,
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.code, 'orders_not_entitled');
  });

  it('sin entrypoint_qr → public_catalog_disabled', () => {
    const gate = gatePublicCatalogRequest({
      pharmacyOperable: true,
      hasEntrypointQr: false,
      hasOrders: true,
    });
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.code, 'public_catalog_disabled');
  });
});

describe('4) Solicitud genérica no aparece como venta gratuita', () => {
  it('estados canónicos ≠ waived y ≠ paid', () => {
    assert.equal(PUBLIC_QR_ORDER_STATUS, 'request_pending');
    assert.equal(PUBLIC_QR_PAYMENT_STATUS, 'pending_confirmation');
    assert.notEqual(PUBLIC_QR_PAYMENT_STATUS, 'waived');
  });

  it('describePublicQrRequestPricing: no es free sale; label pendiente', () => {
    const d = describePublicQrRequestPricing({
      source: 'public_qr',
      paymentStatus: 'pending_confirmation',
      orderStatus: 'request_pending',
      totalAmount: 0,
      catalogMode: 'generic',
    });
    assert.equal(d.isPendingConfirmation, true);
    assert.equal(d.isFreeSale, false);
    assert.equal(d.showEuroTotal, false);
    assert.equal(
      d.dashboardLabel,
      'Precio y disponibilidad pendientes de confirmar'
    );
  });

  it('dashboardLabel no es importe en euros ni «exento»', () => {
    const d = describePublicQrRequestPricing({
      source: 'public_qr',
      paymentStatus: 'pending_confirmation',
      orderStatus: 'request_pending',
      totalAmount: 0,
      catalogMode: 'generic',
    });
    assert.ok(!d.dashboardLabel.includes('0,00'));
    assert.ok(!/€/.test(d.dashboardLabel));
    assert.ok(!/exento|gratuita|waived/i.test(d.dashboardLabel));
  });
});

describe('5) Producto de otra farmacia rechazado', () => {
  it('validatePublicRequestLines no autoriza pharmacy_id (solo productId)', () => {
    // El aislamiento por farmacia ocurre en el RPC; el cliente nunca envía pharmacy_id.
    const lines = validatePublicRequestLines([
      { productId: PID_A, quantity: 1 },
      { productId: PID_B, quantity: 1 },
    ]);
    assert.equal(lines.ok, true);
    // Contrato: no hay campo pharmacyId en el payload validado.
    if (lines.ok) {
      assert.equal('pharmacyId' in lines.lines[0], false);
    }
  });

  it('RPC status product_wrong_pharmacy está mapeado', async () => {
    const { mapPublicRequestRpcStatus } = await import(
      './public-catalog-request-validation.ts'
    );
    assert.equal(
      mapPublicRequestRpcStatus('product_wrong_pharmacy'),
      'product_wrong_pharmacy'
    );
  });
});

describe('6) Duplicados y límites de envío', () => {
  it('rechaza duplicados y qty fuera de rango', () => {
    assert.equal(
      validatePublicRequestLines([
        { productId: PID_A, quantity: 1 },
        { productId: PID_A, quantity: 2 },
      ]).ok,
      false
    );
    assert.equal(
      validatePublicRequestLines([
        { productId: PID_A, quantity: PUBLIC_REQUEST_MAX_QTY + 1 },
      ]).ok,
      false
    );
  });

  it('rate-limit documentado (5/hora) en constante espejo SQL', () => {
    assert.equal(PUBLIC_REQUEST_RATE_LIMIT_PER_HOUR, 5);
  });
});

describe('7) Pedidos anteriores siguen funcionando', () => {
  it('transiciones kiosko 040 intactas', () => {
    assert.equal(
      isOrderStatusTransitionAllowed('pending_payment', 'preparing'),
      true
    );
    assert.equal(
      isOrderStatusTransitionAllowed('preparing', 'ready'),
      true
    );
    assert.equal(isPaymentStatusTransitionAllowed('unpaid', 'paid'), true);
    assert.equal(isPaymentStatusTransitionAllowed('unpaid', 'waived'), true);
  });

  it('solicitud QR puede pasar a preparing; pending_confirmation → unpaid', () => {
    assert.equal(
      isOrderStatusTransitionAllowed('request_pending', 'preparing'),
      true
    );
    assert.equal(
      isPaymentStatusTransitionAllowed('pending_confirmation', 'unpaid'),
      true
    );
    assert.equal(
      isPaymentStatusTransitionAllowed('pending_confirmation', 'waived'),
      true
    );
  });
});

describe('8) No hay dependencia de SMS OTP ni sesión kiosko', () => {
  it('auth requirements: guest name/phone only', () => {
    const auth = publicCatalogRequestAuthRequirements();
    assert.equal(auth.requiresKioskSession, false);
    assert.equal(auth.requiresCustomerAccount, false);
    assert.equal(auth.requiresSmsOtp, false);
    assert.equal(auth.guestNamePhoneAllowed, true);
  });

  it('planes personalizados no usan guest QR como canal principal de cuenta', () => {
    assert.equal(planAllowsGuestPublicCatalogRequests('personalized'), false);
    assert.equal(
      planAllowsGuestPublicCatalogRequests('ai_personalized'),
      false
    );
  });
});
