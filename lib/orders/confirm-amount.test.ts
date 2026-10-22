import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseConfirmableEuroAmount } from './euro-amount.ts';
import { canConfirmOrderAmount } from './public-qr-display.ts';

describe('parseConfirmableEuroAmount', () => {
  it('acepta 12,50 y 0', () => {
    assert.deepEqual(parseConfirmableEuroAmount('12,50'), {
      ok: true,
      amount: 12.5,
    });
    assert.deepEqual(parseConfirmableEuroAmount(0), { ok: true, amount: 0 });
  });

  it('rechaza más de 2 decimales y negativos', () => {
    assert.equal(parseConfirmableEuroAmount('12.555').ok, false);
    assert.equal(parseConfirmableEuroAmount(-1).ok, false);
    assert.equal(parseConfirmableEuroAmount('abc').ok, false);
  });
});

describe('canConfirmOrderAmount', () => {
  it('permite request_pending, preparing y ready', () => {
    assert.equal(canConfirmOrderAmount('request_pending'), true);
    assert.equal(canConfirmOrderAmount('preparing'), true);
    assert.equal(canConfirmOrderAmount('ready'), true);
  });

  it('bloquea delivered y cancelled', () => {
    assert.equal(canConfirmOrderAmount('delivered'), false);
    assert.equal(canConfirmOrderAmount('cancelled'), false);
  });
});
