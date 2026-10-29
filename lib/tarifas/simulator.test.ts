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
  planAnnualReferenceCents,
  annualFromMonthly,
  applyBps,
  applySaleSurchargeBps,
  eurosToCents,
  formatCentsEur,
  calculateQuote,
  saasMonthlyCentsForCohort,
  saasMonthlySaleCents,
  roundCentsToEuro,
} from './engine.ts';

const cfg = DEFAULT_COMMERCIAL_TARIFF_CONFIG;

describe('tarifas base', () => {
  it('precios mensuales oficiales', () => {
    assert.equal(getPlan(cfg, 'pilot').monthlyCents, 0);
    assert.equal(getPlan(cfg, 'general').monthlyCents, eurosToCents(97.5));
    assert.equal(getPlan(cfg, 'personalized').monthlyCents, eurosToCents(172.5));
    assert.equal(
      getPlan(cfg, 'ai_personalized').monthlyCents,
      eurosToCents(247.5)
    );
  });

  it('referencias anuales prepago (−15 %) redondeadas al euro', () => {
    assert.equal(planAnnualReferenceCents(cfg, 'general'), eurosToCents(995));
    assert.equal(
      planAnnualReferenceCents(cfg, 'personalized'),
      eurosToCents(1760)
    );
    assert.equal(
      planAnnualReferenceCents(cfg, 'ai_personalized'),
      eurosToCents(2525)
    );
    assert.equal(
      roundCentsToEuro(annualFromMonthly(eurosToCents(97.5), 1500)),
      eurosToCents(995)
    );
  });

  it('IVA 21 %, dto. anual SaaS 15 % y alquiler sin dto. anual', () => {
    assert.equal(cfg.vatBps, 2100);
    assert.equal(cfg.saasAnnualDiscountBps, 1500);
    assert.equal(cfg.kioskLicenseAnnualDiscountBps, 0);
    assert.equal(cfg.kioskLicenseMonthlyCents, eurosToCents(49));
    assert.equal(cfg.kioskHardwareUnitCents, eurosToCents(1090));
    assert.equal(cfg.kioskInternalCostCents, eurosToCents(680));
    assert.equal(applyBps(eurosToCents(100), 2100), eurosToCents(21));
    assert.equal(kioskLicenseAnnualCents(cfg), eurosToCents(49) * 12);
  });
});

describe('descuentos de lanzamiento / cohorte (solo SaaS)', () => {
  it('tabla de cuotas mensuales SaaS', () => {
    const cases: Array<{
      plan: 'general' | 'personalized' | 'ai_personalized';
      normal: number;
      y2027: number;
      y2028: number;
    }> = [
      { plan: 'general', normal: 97.5, y2027: 39, y2028: 68.25 },
      { plan: 'personalized', normal: 172.5, y2027: 69, y2028: 120.75 },
      { plan: 'ai_personalized', normal: 247.5, y2027: 99, y2028: 173.25 },
    ];

    for (const c of cases) {
      const base = getPlan(cfg, c.plan).monthlyCents;
      assert.equal(base, eurosToCents(c.normal));
      assert.equal(
        saasMonthlyCentsForCohort(base, cfg.assumptions, 'normal'),
        eurosToCents(c.normal)
      );
      assert.equal(
        saasMonthlyCentsForCohort(base, cfg.assumptions, 'launch_2027'),
        eurosToCents(c.y2027)
      );
      assert.equal(
        saasMonthlyCentsForCohort(
          base,
          cfg.assumptions,
          'cohort_2027_in_2028'
        ),
        eurosToCents(c.y2028)
      );
    }
  });

  it('IA y IA+kiosko comparten la misma base SaaS', () => {
    assert.equal(
      saasMonthlySaleCents(cfg, 'ai_personalized', 'normal'),
      eurosToCents(247.5)
    );
  });

  it('plazas y previsión de altas son independientes', () => {
    assert.equal(cfg.assumptions.launchSlots2027, 20);
    assert.equal(cfg.assumptions.forecastSignups2027, 15);
  });
});

describe('recargo de equivalencia (solo precios de venta)', () => {
  it('0 % deja intactas las cuotas; 4 % sube SaaS y personalización, no el alquiler', () => {
    const base = calculateQuote(cfg, {
      planId: 'general',
      interval: 'monthly',
      kioskCount: 1,
      includeAppSignupFee: false,
    });
    assert.equal(base.planRecurringCents, eurosToCents(97.5));
    assert.equal(base.kioskLicenseRecurringCents, eurosToCents(49));
    assert.equal(base.hardwareCents, eurosToCents(1090));

    const withSurcharge = {
      ...cfg,
      assumptions: {
        ...cfg.assumptions,
        equivalenceSurchargeBps: 400,
      },
    };
    const q = calculateQuote(withSurcharge, {
      planId: 'general',
      interval: 'monthly',
      kioskCount: 1,
      includeAppSignupFee: false,
    });
    assert.equal(
      q.planRecurringCents,
      applySaleSurchargeBps(eurosToCents(97.5), 400)
    );
    assert.equal(q.kioskLicenseRecurringCents, eurosToCents(49));
    assert.equal(
      q.hardwareCents,
      applySaleSurchargeBps(eurosToCents(1090), 400)
    );
    assert.equal(q.hardwareCostCents, eurosToCents(680));

    const restored = calculateQuote(cfg, {
      planId: 'general',
      interval: 'monthly',
      kioskCount: 1,
      includeAppSignupFee: false,
    });
    assert.equal(restored.planRecurringCents, eurosToCents(97.5));
  });
});

describe('alta de aplicación e instalación presencial', () => {
  it('pago inicial incluye 190 € de alta; cuotas posteriores no', () => {
    const q = calculateQuote(cfg, {
      planId: 'general',
      interval: 'monthly',
      kioskCount: 0,
      includeAppSignupFee: true,
    });
    assert.equal(q.appSignupFeeCents, eurosToCents(190));
    assert.equal(q.oneTimeNetCents, eurosToCents(190));
    assert.equal(q.planRecurringCents, eurosToCents(97.5));
    assert.equal(q.laterYearsRecurringNetCents, eurosToCents(97.5) * 12);
    assert.equal(
      q.firstYearNetCents,
      eurosToCents(190) + eurosToCents(97.5) * 12
    );
  });

  it('marcar instalación incluida no altera ningún importe', () => {
    const without = calculateQuote(cfg, {
      planId: 'general',
      interval: 'monthly',
      kioskCount: 1,
      onsiteInstallIncluded: false,
      includeAppSignupFee: true,
    });
    const withInstall = calculateQuote(cfg, {
      planId: 'general',
      interval: 'monthly',
      kioskCount: 1,
      onsiteInstallIncluded: true,
      // Valores legacy que no deben afectar.
      onsiteInstallCents: eurosToCents(999),
      additionalServicesCents: eurosToCents(50),
      oneTimeDiscountCents: eurosToCents(20),
      recurringExtraDiscountCents: eurosToCents(10),
      includeAppSignupFee: true,
    });
    assert.equal(withInstall.onsiteInstallIncluded, true);
    assert.equal(withInstall.onsiteInstallCents, 0);
    assert.equal(withInstall.additionalServicesCents, 0);
    assert.equal(withInstall.oneTimeDiscountCents, 0);
    assert.equal(withInstall.recurringExtraDiscountCents, 0);
    assert.equal(withInstall.oneTimeNetCents, without.oneTimeNetCents);
    assert.equal(withInstall.recurringNetCents, without.recurringNetCents);
    assert.equal(withInstall.firstYearNetCents, without.firstYearNetCents);
    assert.equal(
      withInstall.laterYearsRecurringNetCents,
      without.laterYearsRecurringNetCents
    );
  });
});

describe('ejemplo control: General mensual + 1 kiosko', () => {
  const q = calculateQuote(cfg, {
    planId: 'general',
    interval: 'monthly',
    kioskCount: 1,
    includeAppSignupFee: true,
  });

  it('cuota recurrente SaaS + alquiler (alquiler fuera del dto.)', () => {
    assert.equal(q.planRecurringCents, eurosToCents(97.5));
    assert.equal(q.kioskLicenseRecurringCents, eurosToCents(49));
    assert.equal(q.recurringNetCents, eurosToCents(146.5));
  });

  it('alta 190 € + personalización 1.090 €', () => {
    assert.equal(q.appSignupFeeCents, eurosToCents(190));
    assert.equal(q.hardwareCents, eurosToCents(1090));
    assert.equal(q.oneTimeNetCents, eurosToCents(1280));
  });

  it('margen hardware interno con coste 680 € (cálculo interno)', () => {
    assert.equal(q.hardwareCostCents, eurosToCents(680));
    assert.equal(q.hardwareProfitCents, eurosToCents(410));
    assert.ok(q.hardwareMarginPercent !== null);
  });
});

describe('ejemplo control: General anual + 1 kiosko', () => {
  const q = calculateQuote(cfg, {
    planId: 'general',
    interval: 'annual',
    kioskCount: 1,
    includeAppSignupFee: false,
  });

  it('SaaS anual con 15 %; alquiler = 12 × mensual sin dto.', () => {
    assert.equal(
      q.planRecurringCents,
      annualFromMonthly(eurosToCents(97.5), 1500)
    );
    assert.equal(q.kioskLicenseRecurringCents, eurosToCents(49) * 12);
  });
});

describe('lanzamiento 2027 en simulador', () => {
  it('General launch_2027: 39 € SaaS + 49 € alquiler', () => {
    const q = calculateQuote(cfg, {
      planId: 'general',
      interval: 'monthly',
      kioskCount: 1,
      cohortPricing: 'launch_2027',
      includeAppSignupFee: false,
    });
    assert.equal(q.planRecurringCents, eurosToCents(39));
    assert.equal(q.kioskLicenseRecurringCents, eurosToCents(49));
    assert.equal(q.recurringNetCents, eurosToCents(88));
  });
});

describe('piloto', () => {
  it('fuerza kioskos a 0 y totales a 0', () => {
    const q = calculateQuote(cfg, {
      planId: 'pilot',
      interval: 'annual',
      kioskCount: 3,
      onsiteInstallIncluded: true,
      onsiteInstallCents: eurosToCents(200),
      additionalServicesCents: eurosToCents(50),
    });
    assert.equal(q.isPilot, true);
    assert.equal(q.kioskCount, 0);
    assert.equal(q.hardwareCents, 0);
    assert.equal(q.appSignupFeeCents, 0);
    assert.equal(q.onsiteInstallIncluded, false);
    assert.equal(q.oneTimeNetCents, 0);
    assert.equal(q.recurringNetCents, 0);
    assert.equal(q.firstYearGrossCents, 0);
  });

  it('no trata la prueba como descuento de suscripción', () => {
    const q = calculateQuote(cfg, {
      planId: 'pilot',
      interval: 'monthly',
      kioskCount: 0,
    });
    assert.equal(q.planRecurringCents, 0);
    assert.equal(formatCentsEur(q.firstYearNetCents), '0,00\u00A0€');
  });
});

describe('supuestos de aprovisionamiento (cantidades)', () => {
  it('inventario, lote y entrega no son porcentajes', () => {
    assert.equal(cfg.assumptions.initialKioskInventoryUnits, 11);
    assert.equal(cfg.assumptions.kioskPurchaseBatchUnits, 10);
    assert.equal(cfg.assumptions.kioskDeliveryMonths, 2);
    assert.equal(cfg.assumptions.kioskInsuranceAnnualCents, eurosToCents(100));
    assert.equal(cfg.assumptions.monthlyChurnBps, 200);
    assert.equal(cfg.assumptions.approximateAnnualChurnBps, 2150);
    assert.equal(cfg.assumptions.annualPrepayAdoptionBps, 0);
    assert.equal(cfg.assumptions.appSignupFeeCents, eurosToCents(190));
  });
});

describe('planAnnualCents con cohorte', () => {
  it('anual normal de General con 15 %', () => {
    assert.equal(
      planAnnualCents(cfg, 'general', 'normal'),
      annualFromMonthly(eurosToCents(97.5), 1500)
    );
  });
});
