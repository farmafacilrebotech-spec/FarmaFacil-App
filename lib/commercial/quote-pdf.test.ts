/**
 * PRE-05B · PDF desde plantilla HTML corporativa (sin path aliases).
 * Replica el cableado de buildCommercialQuotePdf: HTML plantilla → Chromium.
 * node --experimental-strip-types --test lib/commercial/quote-pdf.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_COMMERCIAL_TARIFF_CONFIG,
  calculateQuote,
} from '../tarifas/engine.ts';
import type { CommercialQuoteSnapshot } from './quote-types.ts';
import { renderCommercialQuoteHtmlFromSnapshot } from './quote-template-html.ts';
import { renderHtmlToPdf } from '../pdf/html-to-pdf.ts';

const cfg = DEFAULT_COMMERCIAL_TARIFF_CONFIG;

function sampleSnapshot(): CommercialQuoteSnapshot {
  const q = calculateQuote(cfg, {
    planId: 'personalized',
    interval: 'monthly',
    kioskCount: 1,
    onsiteInstallIncluded: true,
    cohortPricing: 'launch_2027',
    includeAppSignupFee: true,
  });
  return {
    v: 1,
    clientName: 'Farmacia Nupre Personalizado',
    contactName: 'Pablo',
    contactEmail: 'pruebas@farmafacil.solutions',
    pharmacyId: null,
    pharmacyName: null,
    planId: 'personalized',
    planName: 'Personalizado',
    interval: 'monthly',
    cohortPricing: 'launch_2027',
    kioskCount: 1,
    onsiteInstallIncluded: true,
    includeAppSignupFee: true,
    appSignupFeeCents: q.appSignupFeeCents,
    hardwareUnitCents: cfg.kioskHardwareUnitCents,
    hardwareCents: q.hardwareCents,
    kioskLicenseMonthlyCents: cfg.kioskLicenseMonthlyCents,
    vatBps: cfg.vatBps,
    saasAnnualDiscountBps: cfg.saasAnnualDiscountBps,
    notes: null,
    validUntil: '2026-12-31',
    commercialConditions: [],
    implantationCompensation: {
      originalOneTimeNetCents: q.oneTimeNetCents,
      compensatedCents: 19_000,
      allocations: [
        {
          paymentId: 'pay-1',
          appliedCents: 19_000,
          concept: 'app_setup',
          label: 'Implantación de la aplicación',
        },
      ],
    },
    breakdown: {
      oneTimeNetCents: Math.max(0, q.oneTimeNetCents - 19_000),
      oneTimeVatCents: Math.round(
        (Math.max(0, q.oneTimeNetCents - 19_000) * cfg.vatBps) / 10_000
      ),
      oneTimeGrossCents:
        Math.max(0, q.oneTimeNetCents - 19_000) +
        Math.round(
          (Math.max(0, q.oneTimeNetCents - 19_000) * cfg.vatBps) / 10_000
        ),
      planRecurringCents: q.planRecurringCents,
      kioskLicenseRecurringCents: q.kioskLicenseRecurringCents,
      recurringNetCents: q.recurringNetCents,
      recurringVatCents: q.recurringVatCents,
      recurringGrossCents: q.recurringGrossCents,
      firstYearSubscriptionCents: q.firstYearSubscriptionCents,
      firstYearNetCents: q.firstYearNetCents - 19_000,
      firstYearVatCents: q.firstYearVatCents,
      firstYearGrossCents: q.firstYearGrossCents,
      laterYearsRecurringNetCents: q.laterYearsRecurringNetCents,
    },
  };
}

describe('PRE-05B HTML corporativo → PDF', () => {
  it('la plantilla incluye compensación y el PDF es válido', async () => {
    const snapshot = sampleSnapshot();
    const html = renderCommercialQuoteHtmlFromSnapshot({
      referenceCode: 'PRE-05B-TEST',
      createdAt: '2026-11-18T12:00:00.000Z',
      snapshot,
    });

    assert.match(html, /Personalizado/);
    assert.match(html, /Compensación implantaciones ya abonadas/);
    assert.match(html, /Oferta Lanzamiento 2027/);

    const pdf = await renderHtmlToPdf(html, { format: 'A4' });
    assert.equal(pdf.mimeType, 'application/pdf');
    assert.ok(pdf.bytes.byteLength > 2_000);
    assert.equal(Buffer.from(pdf.bytes.slice(0, 5)).toString('utf8'), '%PDF-');
  });
});
