import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CLIENT_AVAILABILITY_COPY,
  formatClientAvailabilityMessage,
  isStockBlockingAvailability,
  requestMaxQuantity,
} from './stock-policy.ts';
import { isPendingClassificationCategory } from './taxonomy.ts';

describe('stock policy (no bloqueante)', () => {
  it('stock nunca bloquea disponibilidad', () => {
    assert.equal(isStockBlockingAvailability(0), false);
    assert.equal(isStockBlockingAvailability(null), false);
    assert.equal(isStockBlockingAvailability(undefined), false);
    assert.equal(isStockBlockingAvailability(5), false);
  });

  it('tope de solicitud es fijo, no inventario', () => {
    assert.equal(requestMaxQuantity(0), 99);
    assert.equal(requestMaxQuantity(null), 99);
    assert.equal(requestMaxQuantity(2), 99);
  });

  it('copy cliente aprobado', () => {
    assert.equal(
      formatClientAvailabilityMessage(),
      CLIENT_AVAILABILITY_COPY.requestable
    );
    assert.match(
      CLIENT_AVAILABILITY_COPY.pharmacyWillConfirm,
      /confirmará cuándo puedes recogerlo/i
    );
  });

  it('archivados / pendientes siguen siendo no comerciales por categoría', () => {
    assert.equal(isPendingClassificationCategory('Pendiente de clasificar'), true);
    assert.equal(isPendingClassificationCategory('Dermocosmética'), false);
  });
});
