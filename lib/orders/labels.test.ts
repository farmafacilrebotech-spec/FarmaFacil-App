import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  nextOrderStatusOptions,
  nextPaymentStatusOptions,
} from './transitions.ts';

describe('order panel transition options', () => {
  it('solo ofrece siguientes estados operativos válidos', () => {
    assert.deepEqual(nextOrderStatusOptions('pending_payment').sort(), [
      'cancelled',
      'preparing',
    ]);
    assert.deepEqual(nextOrderStatusOptions('delivered'), []);
  });

  it('separa opciones de pago del estado operativo', () => {
    assert.deepEqual(nextPaymentStatusOptions('unpaid').sort(), [
      'paid',
      'waived',
    ]);
    assert.ok(!nextPaymentStatusOptions('unpaid').includes('refunded'));
  });
});
