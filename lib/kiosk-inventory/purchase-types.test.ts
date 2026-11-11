/**
 * Pedidos de compra de kioskos — lógica pura.
 * node --experimental-strip-types --test lib/kiosk-inventory/purchase-types.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_KIOSK_DELIVERY_LEAD_MONTHS,
  KIOSK_PO_DOC_LABELS,
  KIOSK_PO_STATUS_LABELS,
  computeEstimatedDeliveryAt,
  stripPurchaseFinancialFields,
} from './purchase-types.ts';

describe('kiosk purchase ETA', () => {
  it('usa 2 meses por defecto desde la fecha de pedido', () => {
    assert.equal(DEFAULT_KIOSK_DELIVERY_LEAD_MONTHS, 2);
    assert.equal(computeEstimatedDeliveryAt('2026-01-15', 2), '2026-03-15');
    assert.equal(computeEstimatedDeliveryAt(null, 2), null);
  });

  it('respeta plazo configurable', () => {
    assert.equal(computeEstimatedDeliveryAt('2026-01-15', 1), '2026-02-15');
    assert.equal(computeEstimatedDeliveryAt('2026-10-15', 0), '2026-10-15');
  });
});

describe('etiquetas y privacidad financiera', () => {
  it('estados y documentos en español', () => {
    assert.equal(KIOSK_PO_STATUS_LABELS.preparado, 'Preparado');
    assert.equal(KIOSK_PO_STATUS_LABELS.parcialmente_recibido, 'Parcialmente recibido');
    assert.equal(KIOSK_PO_DOC_LABELS.supplier_quote, 'Presupuesto del proveedor');
    assert.equal(KIOSK_PO_DOC_LABELS.invoice, 'Factura');
  });

  it('elimina importes al filtrar para perfiles no financieros', () => {
    const stripped = stripPurchaseFinancialFields({
      id: '1',
      supplierName: 'Vendor',
      unitPriceCents: 100000,
      shippingCents: 5000,
      totalCents: 105000,
      quantity: 2,
    });
    assert.equal(stripped.supplierName, 'Vendor');
    assert.equal(stripped.quantity, 2);
    assert.equal('unitPriceCents' in stripped, false);
    assert.equal('totalCents' in stripped, false);
  });
});
