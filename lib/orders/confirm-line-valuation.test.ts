import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapPublicQrLineValuationPayload } from './confirm-line-valuation-map.ts';

describe('mapPublicQrLineValuationPayload', () => {
  const okBody = {
    status: 'ok',
    unchanged: false,
    order_id: 'bda60631-2df5-4c46-acc0-a500ff1cb888',
    order_status: 'ready',
    payment_status: 'unpaid',
    total_amount: 2.09,
    available_lines: 1,
    amount_confirmed: true,
    amount_confirmed_at: '2026-10-26T14:11:50.36532+00',
    lines_valued_at: '2026-10-26T14:11:50.36532+00',
    customer_accepted_at: null,
    awaiting_customer_acceptance: true,
    updated_at: '2026-10-26T14:11:50.36532+00',
  };

  it('guardado exitoso desde objeto', () => {
    const r = mapPublicQrLineValuationPayload(okBody);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.totalAmount, 2.09);
    assert.equal(r.updatedAt, '2026-10-26T14:11:50.36532+00');
    assert.equal(r.awaitingCustomerAcceptance, true);
    assert.equal(r.status, 'ready');
    assert.equal(r.paymentStatus, 'unpaid');
  });

  it('guardado exitoso desde string JSON (evita falso error rojo)', () => {
    const r = mapPublicQrLineValuationPayload(JSON.stringify(okBody));
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.totalAmount, 2.09);
    assert.equal(r.linesValuedAt, '2026-10-26T14:11:50.36532+00');
    assert.equal(r.updatedAt, '2026-10-26T14:11:50.36532+00');
  });

  it('segundo guardado válido sin updated_at en RPC antigua', () => {
    const { updated_at: _drop, ...legacyOk } = okBody;
    const r = mapPublicQrLineValuationPayload(legacyOk);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.updatedAt, null);
    assert.equal(r.totalAmount, 2.09);
  });

  it('conflicto real de concurrencia', () => {
    const r = mapPublicQrLineValuationPayload({
      status: 'concurrent_modification',
      updated_at: '2026-10-26T15:00:00+00',
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'concurrent_modification');
    assert.match(r.error, /recargado|cambió/i);
  });

  it('payload ilegible → error controlado (no ok falso-positivo)', () => {
    const r = mapPublicQrLineValuationPayload('<<<');
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'unknown');
  });
});
