import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  mapPublicQuoteDecidePayload,
  mapPublicQuoteGetPayload,
} from './public-quote-map.ts';

describe('mapPublicQuoteGetPayload', () => {
  it('mapea presupuesto pendiente', () => {
    const r = mapPublicQuoteGetPayload({
      status: 'ok',
      quote_state: 'awaiting_decision',
      pharmacy_name: 'Farmacia Test',
      display_number: '0010',
      quote_version: 1,
      currency: 'EUR',
      total_amount: 12.5,
      expires_at: '2099-01-01T00:00:00+00',
      decided_at: null,
      decision: null,
      can_decide: true,
      lines: [
        {
          product_name: 'Champú',
          quantity: 1,
          availability: 'available',
          unit_price: 5.5,
          line_total: 5.5,
        },
        {
          product_name: 'Solar',
          quantity: 1,
          availability: 'unavailable',
          unit_price: 0,
          line_total: 0,
        },
      ],
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.canDecide, true);
    assert.equal(r.totalAmount, 12.5);
    assert.equal(r.lines.length, 2);
  });

  it('token inválido genérico', () => {
    const r = mapPublicQuoteGetPayload({ status: 'invalid_token' });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'invalid_token');
  });
});

describe('mapPublicQuoteDecidePayload', () => {
  it('aceptación ok', () => {
    const r = mapPublicQuoteDecidePayload({
      status: 'ok',
      unchanged: false,
      decision: 'accepted',
      decided_at: '2026-10-26T16:00:00+00',
      display_number: '0010',
      total_amount: 12.5,
      quote_version: 1,
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.decision, 'accepted');
  });

  it('already_decided', () => {
    const r = mapPublicQuoteDecidePayload({
      status: 'already_decided',
      decision: 'rejected',
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, 'already_decided');
  });
});
