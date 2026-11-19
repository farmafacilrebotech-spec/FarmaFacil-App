/**
 * PRE-05D · PDF corporativo: páginas F0TQ, importes y casos densos.
 * node --experimental-strip-types --test lib/commercial/quote-pdf.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_COMMERCIAL_TARIFF_CONFIG,
  calculateQuote,
  type BillingInterval,
} from '../tarifas/engine.ts';
import type { CommercialQuoteSnapshot } from './quote-types.ts';
import { renderCommercialQuoteHtmlFromSnapshot } from './quote-template-html.ts';
import { renderHtmlToPdf } from '../pdf/html-to-pdf.ts';
import { countPdfPages } from '../pdf/count-pdf-pages.ts';

const cfg = DEFAULT_COMMERCIAL_TARIFF_CONFIG;
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '../../tmp');

function snapshotFor(opts: {
  interval?: BillingInterval;
  kioskCount?: number;
  clientName?: string;
  contactName?: string;
  compensatedCents?: number;
}): CommercialQuoteSnapshot {
  const interval = opts.interval ?? 'annual';
  const kioskCount = opts.kioskCount ?? 1;
  const q = calculateQuote(cfg, {
    planId: 'personalized',
    interval,
    kioskCount,
    onsiteInstallIncluded: true,
    cohortPricing: 'launch_2027',
    includeAppSignupFee: true,
  });
  const compensated = Math.max(0, opts.compensatedCents ?? 0);
  const oneTimeNet = Math.max(0, q.oneTimeNetCents - compensated);
  const oneTimeVat = Math.round((oneTimeNet * cfg.vatBps) / 10_000);
  return {
    v: 1,
    clientName:
      opts.clientName ?? 'Farmacia Nupre Personalizado',
    contactName: opts.contactName ?? 'Pablo',
    contactEmail: 'pruebas@farmafacil.solutions',
    pharmacyId: null,
    pharmacyName: null,
    planId: 'personalized',
    planName: 'Personalizado',
    interval,
    cohortPricing: 'launch_2027',
    kioskCount,
    onsiteInstallIncluded: true,
    includeAppSignupFee: true,
    appSignupFeeCents: q.appSignupFeeCents,
    hardwareUnitCents: cfg.kioskHardwareUnitCents,
    hardwareCents: q.hardwareCents,
    kioskLicenseMonthlyCents: cfg.kioskLicenseMonthlyCents,
    vatBps: cfg.vatBps,
    saasAnnualDiscountBps: cfg.saasAnnualDiscountBps,
    notes: null,
    validUntil: '2026-12-18',
    commercialConditions: [],
    implantationCompensation:
      compensated > 0
        ? {
            originalOneTimeNetCents: q.oneTimeNetCents,
            compensatedCents: compensated,
            allocations: [
              {
                paymentId: 'pay-1',
                appliedCents: compensated,
                concept: 'app_setup',
                label: 'Implantación de la aplicación',
              },
            ],
          }
        : null,
    breakdown: {
      oneTimeNetCents: oneTimeNet,
      oneTimeVatCents: oneTimeVat,
      oneTimeGrossCents: oneTimeNet + oneTimeVat,
      planRecurringCents: q.planRecurringCents,
      kioskLicenseRecurringCents: q.kioskLicenseRecurringCents,
      recurringNetCents: q.recurringNetCents,
      recurringVatCents: q.recurringVatCents,
      recurringGrossCents: q.recurringGrossCents,
      firstYearSubscriptionCents: q.firstYearSubscriptionCents,
      firstYearNetCents: q.firstYearNetCents - compensated,
      firstYearVatCents: q.firstYearVatCents,
      firstYearGrossCents: q.firstYearGrossCents - compensated - Math.round((compensated * cfg.vatBps) / 10_000),
      laterYearsRecurringNetCents: q.laterYearsRecurringNetCents,
    },
  };
}

async function pdfFor(
  referenceCode: string,
  snapshot: CommercialQuoteSnapshot
) {
  const html = renderCommercialQuoteHtmlFromSnapshot({
    referenceCode,
    createdAt: '2026-11-18T06:35:07.473Z',
    snapshot,
  });
  const pdf = await renderHtmlToPdf(html, { format: 'A4' });
  return { html, pdf };
}

describe('PRE-05D HTML corporativo → PDF', () => {
  it('F0TQ anual: exactamente 2 páginas A4, importes y sin página vacía', async () => {
    const snapshot = snapshotFor({ interval: 'annual', kioskCount: 1 });
    assert.equal(snapshot.breakdown.oneTimeGrossCents, 154880);
    assert.equal(snapshot.breakdown.firstYearSubscriptionCents, 129180);
    assert.equal(snapshot.breakdown.recurringGrossCents, 156308);
    assert.equal(snapshot.breakdown.firstYearGrossCents, 311188);

    const { html, pdf } = await pdfFor('FF-PRE-20261118-F0TQ', snapshot);
    assert.match(html, /Coste recurrente anualizado sin IVA/);
    assert.match(html, /Coste recurrente anualizado con IVA/);
    assert.match(html, /1\.291,80 €/);
    assert.match(html, /1\.563,08 €/);
    assert.match(html, /1\.548,80 €/);
    assert.match(html, /851,60 €/);
    assert.match(html, /59,29 €/);
    assert.match(html, /3\.111,88 €/);
    assert.match(html, /data:image\/png;base64,/);
    assert.equal(html.includes('farmafacil-mark.svg'), false);

    assert.equal(pdf.mimeType, 'application/pdf');
    assert.equal(Buffer.from(pdf.bytes.slice(0, 5)).toString('utf8'), '%PDF-');
    const pages = countPdfPages(pdf.bytes);
    assert.equal(pages, 2, `esperadas 2 páginas, obtuvo ${pages}`);

    mkdirSync(outDir, { recursive: true });
    const out = join(outDir, 'PRE05D-F0TQ-corregido.pdf');
    writeFileSync(out, pdf.bytes);
  });

  it('nombres largos, 3 kioskos y compensación: sigue en 2 páginas', async () => {
    const snapshot = snapshotFor({
      interval: 'annual',
      kioskCount: 3,
      clientName:
        'Farmacia Municipal de San Cristóbal de La Laguna · Grupo Farma Norte SLU',
      contactName: 'María del Carmen Rodríguez-Pérez de los Santos',
      compensatedCents: 19_000,
    });
    const { html, pdf } = await pdfFor('FF-PRE-20261119-DENSE', snapshot);
    assert.match(html, /Compensación implantaciones ya abonadas/);
    assert.match(html, /3 kioskos|kiosko/);
    const pages = countPdfPages(pdf.bytes);
    assert.equal(pages, 2, `caso denso: esperadas 2, obtuvo ${pages}`);
  });
});
