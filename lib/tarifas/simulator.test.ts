/**
 * Pruebas de regresión del simulador comercial (céntimos).
 * npm run test:tarifas
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COMMERCIAL_TARIFF_CONFIG,
  getPlan,
  kioskLicenseAnnualCents,
  planAnnualCents,
  annualFromMonthly,
  applyBps,
  eurosToCents,
  formatCentsEur,
  calculateQuote,
} from './engine.ts';

const cfg = DEFAULT_COMMERCIAL_TARIFF_CONFIG;

describe('tarifas base', () => {
  it('precios mensuales oficiales', () => {
    assert.equal(getPlan(cfg, 'pilot').monthlyCents, 0);
    assert.equal(getPlan(cfg, 'general').monthlyCents, eurosToCents(39));
    assert.equal(getPlan(cfg, 'personalized').monthlyCents, eurosToCents(69));
    assert.equal(
      getPlan(cfg, 'ai_personalized').monthlyCents,
      eurosToCents(99)
    );
  });

  it('precios anuales con 15 % de descuento', () => {
    assert.equal(planAnnualCents(cfg, 'general'), eurosToCents(397.8));
    assert.equal(planAnnualCents(cfg, 'personalized'), eurosToCents(703.8));
    assert.equal(planAnnualCents(cfg, 'ai_personalized'), eurosToCents(1009.8));
    assert.equal(kioskLicenseAnnualCents(cfg), eurosToCents(193.8));
  });

  it('IVA 21 % y descuentos en bps', () => {
    assert.equal(cfg.vatBps, 2100);
    assert.equal(cfg.saasAnnualDiscountBps, 1500);
    assert.equal(applyBps(eurosToCents(100), 2100), eurosToCents(21));
    assert.equal(annualFromMonthly(eurosToCents(39), 1500), eurosToCents(397.8));
  });
});

describe('ejemplo control: General mensual + 1 kiosko', () => {
  const q = calculateQuote(cfg, {
    planId: 'general',
    interval: 'monthly',
    kioskCount: 1,
    onsiteInstallCents: 0,
    additionalServicesCents: 0,
    oneTimeDiscountCents: 0,
    recurringExtraDiscountCents: 0,
  });

  it('cuota recurrente 58 €/mes', () => {
    assert.equal(q.planRecurringCents, eurosToCents(39));
    assert.equal(q.kioskLicenseRecurringCents, eurosToCents(19));
    assert.equal(q.recurringNetCents, eurosToCents(58));
  });

  it('hardware 1.290 € y primer año 1.986 € sin IVA', () => {
    assert.equal(q.hardwareCents, eurosToCents(1290));
    assert.equal(q.oneTimeNetCents, eurosToCents(1290));
    assert.equal(q.firstYearSubscriptionCents, eurosToCents(696));
    assert.equal(q.firstYearNetCents, eurosToCents(1986));
  });

  it('IVA y total primer año con IVA', () => {
    assert.equal(q.firstYearVatCents, eurosToCents(417.06));
    assert.equal(q.firstYearGrossCents, eurosToCents(2403.06));
  });

  it('margen hardware interno ~37,98 %', () => {
    assert.equal(q.hardwareCostCents, eurosToCents(800));
    assert.equal(q.hardwareProfitCents, eurosToCents(490));
    assert.ok(q.hardwareMarginPercent !== null);
    assert.equal(Number(q.hardwareMarginPercent!.toFixed(2)), 37.98);
  });
});

describe('ejemplo control: General anual + 1 kiosko', () => {
  const q = calculateQuote(cfg, {
    planId: 'general',
    interval: 'annual',
    kioskCount: 1,
    onsiteInstallCents: 0,
    additionalServicesCents: 0,
    oneTimeDiscountCents: 0,
    recurringExtraDiscountCents: 0,
  });

  it('suscripciones anuales 591,60 €', () => {
    assert.equal(q.planRecurringCents, eurosToCents(397.8));
    assert.equal(q.kioskLicenseRecurringCents, eurosToCents(193.8));
    assert.equal(q.recurringNetCents, eurosToCents(591.6));
  });

  it('primer año 1.881,60 € + IVA 395,14 € = 2.276,74 €', () => {
    assert.equal(q.hardwareCents, eurosToCents(1290));
    assert.equal(q.firstYearNetCents, eurosToCents(1881.6));
    assert.equal(q.firstYearVatCents, eurosToCents(395.14));
    assert.equal(q.firstYearGrossCents, eurosToCents(2276.74));
  });
});

describe('piloto', () => {
  it('fuerza kioskos a 0 y totales a 0', () => {
    const q = calculateQuote(cfg, {
      planId: 'pilot',
      interval: 'annual',
      kioskCount: 3,
      onsiteInstallCents: eurosToCents(200),
      additionalServicesCents: eurosToCents(50),
      oneTimeDiscountCents: 0,
      recurringExtraDiscountCents: 0,
    });
    assert.equal(q.isPilot, true);
    assert.equal(q.kioskCount, 0);
    assert.equal(q.hardwareCents, 0);
    assert.equal(q.oneTimeNetCents, 0);
    assert.equal(q.recurringNetCents, 0);
    assert.equal(q.firstYearGrossCents, 0);
  });

  it('no trata la prueba como descuento de suscripción', () => {
    const q = calculateQuote(cfg, {
      planId: 'pilot',
      interval: 'monthly',
      kioskCount: 0,
      onsiteInstallCents: 0,
      additionalServicesCents: 0,
      oneTimeDiscountCents: 0,
      recurringExtraDiscountCents: 0,
    });
    assert.equal(q.planRecurringCents, 0);
    assert.equal(formatCentsEur(q.firstYearNetCents), '0,00\u00A0€');
  });
});

describe('descuentos puntuales', () => {
  it('no aplica descuento anual al hardware', () => {
    const q = calculateQuote(cfg, {
      planId: 'general',
      interval: 'annual',
      kioskCount: 2,
      onsiteInstallCents: 0,
      additionalServicesCents: 0,
      oneTimeDiscountCents: 0,
      recurringExtraDiscountCents: 0,
    });
    assert.equal(q.hardwareCents, eurosToCents(1290) * 2);
  });
});
