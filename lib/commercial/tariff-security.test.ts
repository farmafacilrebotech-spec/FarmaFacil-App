import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_COMMERCIAL_TARIFF_CONFIG,
  calculateQuote,
  withoutInternalCosts,
} from '../tarifas/engine.ts';

describe('tariff internal cost security (payload)', () => {
  it('withoutInternalCosts anula el coste en el objeto serializable', () => {
    const publicCfg = withoutInternalCosts(DEFAULT_COMMERCIAL_TARIFF_CONFIG);
    assert.equal(publicCfg.kioskInternalCostCents, null);
    assert.ok(
      (DEFAULT_COMMERCIAL_TARIFF_CONFIG.kioskInternalCostCents ?? 0) > 0
    );
    // Precios comerciales (hardware venta) sí permanecen
    assert.ok(publicCfg.kioskHardwareUnitCents > 0);
  });

  it('sin coste interno el margen no se calcula (no filtrar 0 como margen real)', () => {
    const publicCfg = withoutInternalCosts(DEFAULT_COMMERCIAL_TARIFF_CONFIG);
    const q = calculateQuote(publicCfg, {
      planId: 'general',
      interval: 'monthly',
      kioskCount: 1,
      onsiteInstallCents: 0,
      additionalServicesCents: 0,
      oneTimeDiscountCents: 0,
      recurringExtraDiscountCents: 0,
    });
    assert.equal(q.hardwareMarginPercent, null);
    assert.equal(q.hardwareCostCents, 0);
    // Totales comerciales intactos
    assert.ok(q.firstYearNetCents > 0);
  });
});
