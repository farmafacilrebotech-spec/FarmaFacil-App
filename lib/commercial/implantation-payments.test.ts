import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyImplantationCompensation,
  implantationPendingCents,
} from './implantation-payments.ts';

describe('implantation-payments', () => {
  it('compensa 190 € sin duplicar', () => {
    const r = applyImplantationCompensation({
      initialNetCents: 128_000,
      payments: [{ id: 'p1', pendingCents: 19_000 }],
    });
    assert.equal(r.originalInitialNetCents, 128_000);
    assert.equal(r.compensatedCents, 19_000);
    assert.equal(r.pendingInitialNetCents, 109_000);
    assert.equal(r.allocations.length, 1);
  });

  it('no aplica más del pendiente', () => {
    const r = applyImplantationCompensation({
      initialNetCents: 10_000,
      payments: [{ id: 'p1', pendingCents: 19_000 }],
    });
    assert.equal(r.compensatedCents, 10_000);
    assert.equal(r.pendingInitialNetCents, 0);
  });

  it('pending = paid - applied', () => {
    assert.equal(
      implantationPendingCents({ amountPaidCents: 19_000, appliedCents: 5_000 }),
      14_000
    );
  });
});
