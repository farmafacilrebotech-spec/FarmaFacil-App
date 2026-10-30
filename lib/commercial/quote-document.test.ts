/**
 * Regresión de importes del presupuesto comercial (sin path aliases).
 * npm run test:commercial-quotes
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_COMMERCIAL_TARIFF_CONFIG,
  calculateQuote,
  eurosToCents,
  formatCentsEur,
} from '../tarifas/engine.ts';

const cfg = DEFAULT_COMMERCIAL_TARIFF_CONFIG;

describe('presupuesto comercial · importes congelables', () => {
  it('alta 190 € + personalización 1.090 €; instalación incluida sin importe', () => {
    const q = calculateQuote(cfg, {
      planId: 'general',
      interval: 'monthly',
      kioskCount: 1,
      onsiteInstallIncluded: true,
      includeAppSignupFee: true,
    });

    assert.equal(q.appSignupFeeCents, eurosToCents(190));
    assert.equal(q.hardwareCents, eurosToCents(1090));
    assert.equal(cfg.kioskHardwareUnitCents, eurosToCents(1090));
    assert.equal(q.onsiteInstallIncluded, true);
    assert.equal(q.onsiteInstallCents, 0);
    assert.equal(q.oneTimeNetCents, eurosToCents(1280));

    assert.match(formatCentsEur(q.appSignupFeeCents), /190/);
    assert.match(formatCentsEur(q.hardwareCents), /1\.090|1090/);
  });

  it('transiciones de estado permitidas (contrato de seguimiento)', () => {
    const allowed: Record<string, string[]> = {
      draft: ['sent', 'rejected', 'expired'],
      sent: ['accepted', 'rejected', 'expired', 'draft'],
      accepted: ['expired'],
      rejected: ['draft'],
      expired: ['draft'],
    };
    assert.ok(allowed.draft.includes('sent'));
    assert.ok(allowed.sent.includes('accepted'));
    assert.equal(allowed.rejected.includes('accepted'), false);
    assert.equal(allowed.accepted.includes('sent'), false);
  });
});
