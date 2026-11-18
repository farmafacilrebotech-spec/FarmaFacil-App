/**
 * PRE-05 (B5) · Presupuesto corporativo HTML.
 * node --experimental-strip-types --test lib/commercial/quote-template-html.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_COMMERCIAL_TARIFF_CONFIG,
  calculateQuote,
  type BillingInterval,
  type CommercialPlanId,
  type SaasCohortPricing,
} from '../tarifas/engine.ts';
import type { CommercialQuoteSnapshot } from './quote-types.ts';
import { COMMERCIAL_QUOTE_TEMPLATE_SOURCE } from './quote-template-source.ts';
import {
  formatQuoteEur,
  mapCommercialQuoteToTemplateData,
  renderCommercialQuoteHtml,
  renderCommercialQuoteHtmlFromSnapshot,
} from './quote-template-html.ts';

const cfg = DEFAULT_COMMERCIAL_TARIFF_CONFIG;
const here = dirname(fileURLToPath(import.meta.url));
const templatePath = join(
  here,
  '../../docs/commercial/templates/FarmaFacil_plantilla_presupuesto.html'
);
const examplePath = join(
  here,
  '../../docs/commercial/templates/FarmaFacil_datos_ejemplo.json'
);

/** Snapshot equivalente a buildCommercialQuoteSnapshot (sin alias @/). */
function snapshotFor(opts: {
  planId?: CommercialPlanId;
  planName?: string;
  interval?: BillingInterval;
  cohortPricing?: SaasCohortPricing;
  kioskCount?: number;
  clientName?: string;
  notes?: string | null;
}): CommercialQuoteSnapshot {
  const planId = opts.planId ?? 'personalized';
  const interval = opts.interval ?? 'monthly';
  const cohortPricing = opts.cohortPricing ?? 'launch_2027';
  const kioskCount = opts.kioskCount ?? 1;
  const q = calculateQuote(cfg, {
    planId,
    interval,
    kioskCount,
    onsiteInstallIncluded: true,
    cohortPricing,
    includeAppSignupFee: true,
  });
  return {
    v: 1,
    clientName: opts.clientName ?? 'Farmacia Nupre Personalizado',
    contactName: 'Pablo',
    contactEmail: 'pruebas@farmafacil.solutions',
    pharmacyId: null,
    pharmacyName: null,
    planId,
    planName: opts.planName ?? 'Personalizado',
    interval,
    cohortPricing,
    kioskCount,
    onsiteInstallIncluded: true,
    includeAppSignupFee: true,
    appSignupFeeCents: q.appSignupFeeCents,
    hardwareUnitCents: cfg.kioskHardwareUnitCents,
    hardwareCents: q.hardwareCents,
    kioskLicenseMonthlyCents: cfg.kioskLicenseMonthlyCents,
    vatBps: cfg.vatBps,
    saasAnnualDiscountBps: cfg.saasAnnualDiscountBps,
    notes: opts.notes ?? null,
    validUntil: '2026-12-18',
    commercialConditions: [],
    breakdown: {
      oneTimeNetCents: q.oneTimeNetCents,
      oneTimeVatCents: q.oneTimeVatCents,
      oneTimeGrossCents: q.oneTimeGrossCents,
      planRecurringCents: q.planRecurringCents,
      kioskLicenseRecurringCents: q.kioskLicenseRecurringCents,
      recurringNetCents: q.recurringNetCents,
      recurringVatCents: q.recurringVatCents,
      recurringGrossCents: q.recurringGrossCents,
      firstYearSubscriptionCents: q.firstYearSubscriptionCents,
      firstYearNetCents: q.firstYearNetCents,
      firstYearVatCents: q.firstYearVatCents,
      firstYearGrossCents: q.firstYearGrossCents,
      laterYearsRecurringNetCents: q.laterYearsRecurringNetCents,
    },
  };
}

const REF = 'FF-PRE-20261118-BHP4';
const CREATED = '2026-11-18T09:00:00.000Z';

function renderBhp4(opts: Parameters<typeof snapshotFor>[0] = {}) {
  const snapshot = snapshotFor(opts);
  return {
    snapshot,
    html: renderCommercialQuoteHtmlFromSnapshot(
      { referenceCode: REF, createdAt: CREATED, snapshot },
      { logoSrc: 'data:image/png;base64,TEST' }
    ),
  };
}

describe('quote-template-html · plantilla corporativa PRE-05', () => {
  it('la fuente embebida coincide con la plantilla anclada en docs (sin logo)', () => {
    const slim = readFileSync(templatePath, 'utf8').replace(
      /data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]{100,}/g,
      '{{ logo_src }}'
    );
    assert.equal(
      COMMERCIAL_QUOTE_TEMPLATE_SOURCE,
      slim,
      'Ejecuta: node scripts/sync-quote-template-source.mjs'
    );
  });

  it('BHP4 mensual: 3.262,16 € con IVA primer año (326216 céntimos)', () => {
    const { snapshot, html } = renderBhp4({ interval: 'monthly' });
    assert.equal(snapshot.breakdown.firstYearGrossCents, 326216);

    for (const text of [
      '3.262,16 €', // total pendiente primer año
      '2.696,00 €', // sin IVA
      '566,16 €', // IVA
      '1.548,80 €', // implantación con impuestos
      '1.280,00 €', // pago inicial neto
      '268,80 €',
      '142,78 €', // cuota mensual con IVA
      '118,00 €', // total mensual sin IVA
      '69,00 €',
      '49,00 €',
      '1.416,00 €',
      // evolución
      '120,75 €',
      '172,50 €',
      '2.037,00 €',
      '2.464,77 €',
      '3.216,18 €',
    ]) {
      assert.ok(html.includes(text), `falta ${text}`);
    }
    assert.ok(html.includes('<th>2027</th><th>2028</th><th>2029+</th>'));
    assert.ok(html.includes('IVA (21 %)'));
    assert.ok(html.includes('Pago mensual'));
    assert.ok(html.includes('Oferta Lanzamiento 2027'));
  });

  it('BHP4 anual: 3.111,88 € con IVA; periodicidad software anual + kiosko mensual', () => {
    const { snapshot, html } = renderBhp4({ interval: 'annual' });
    assert.equal(snapshot.breakdown.firstYearGrossCents, 311188);
    for (const text of [
      '3.111,88 €',
      '1.548,80 €',
      '851,60 €',
      '59,29 €',
      '1.563,08 €',
      'Coste recurrente anualizado · con IVA',
      'Software anual · kiosko mensual',
      'Software / mes (equiv. prepago anual)',
    ]) {
      assert.ok(html.includes(text), `falta ${text}`);
    }
    assert.equal(html.includes('Cuota anual · con IVA'), false);
  });

  it('no incluye planes legacy ni textos del compositor / marcadores sin resolver', () => {
    for (const interval of ['monthly', 'annual'] as const) {
      const { html } = renderBhp4({ interval });
      assert.equal(/starter/i.test(html), false, 'Starter');
      assert.equal(/Escribe aquí/i.test(html), false, 'hint compositor');
      assert.equal(/data-ff-composer/i.test(html), false, 'composer attr');
      assert.equal(/\{\{\s*[\w.]|\{%\s*\w/.test(html), false, 'marcador sin resolver');
      assert.equal(/alquiler/i.test(html), false, 'alquiler');
      assert.equal(/\bundefined\b|\bnull\b|NaN/.test(html), false);
    }
  });

  it('usa «Cuota mensual de uso del kiosko FarmaFácil» y no «Uso kiosko»', () => {
    const { html } = renderBhp4();
    assert.ok(html.includes('Cuota mensual de uso del kiosko FarmaFácil'));
    assert.equal(/Uso (del )?kiosko \//.test(html), false);
  });

  it('estructura de datos coincide con el JSON de ejemplo (importes BHP4)', () => {
    const example = JSON.parse(readFileSync(examplePath, 'utf8'));
    const data = mapCommercialQuoteToTemplateData({
      referenceCode: REF,
      createdAt: CREATED,
      snapshot: snapshotFor({}),
    });
    assert.deepEqual(Object.keys(data).sort(), Object.keys(example).sort());
    for (const k of [
      'referencia',
      'fecha',
      'vigencia',
      'farmacia',
      'plan',
      'modalidad',
      'oferta',
      'inicial_bruto',
      'cuota_destacada',
      'inicial_neto',
      'inicial_impuestos',
      'recurrente_anual',
      'total_neto',
      'total_impuestos',
      'total_bruto',
      'anios',
    ]) {
      assert.deepEqual(
        (data as Record<string, unknown>)[k],
        example[k],
        `campo ${k}`
      );
    }
    // Evolución: mismos importes; la fila del kiosko usa la etiqueta legal aprobada.
    assert.deepEqual(
      data.evolucion.map((r) => r.valores),
      example.evolucion.map((r: { valores: string[] }) => r.valores)
    );
    assert.deepEqual(
      data.evolucion.map((r) => r.destacado),
      example.evolucion.map((r: { destacado: boolean }) => r.destacado)
    );
    assert.deepEqual(
      data.iniciales.map((r) => r.valor),
      example.iniciales.map((r: { valor: string }) => r.valor)
    );
    // Cuotas: netos mensuales BHP4 + filas con IVA (PRE-05C claridad).
    assert.ok(data.cuotas.some((r) => r.valor === '69,00 €'));
    assert.ok(data.cuotas.some((r) => r.valor === '49,00 €'));
    assert.ok(data.cuotas.some((r) => r.valor === '118,00 €'));
    assert.ok(data.cuotas.some((r) => r.valor === '83,49 €')); // 69 + IVA
    assert.ok(data.cuotas.some((r) => r.valor === '59,29 €')); // 49 + IVA
  });

  it('escapa HTML en datos de cliente y añade nota como condición', () => {
    const { html } = renderBhp4({
      clientName: 'Farmacia <b>"X"</b> & Hijos',
      notes: '<script>alert(1)</script>',
    });
    assert.equal(html.includes('<b>"X"</b>'), false);
    assert.equal(html.includes('<script>'), false);
    assert.ok(html.includes('Farmacia &lt;b&gt;&quot;X&quot;&lt;/b&gt; &amp; Hijos'));
    assert.ok(html.includes('Nota: &lt;script&gt;'));
  });

  it('logo: opción explícita y data URI circular oficial (SVG) por defecto en Node', () => {
    const { html } = renderBhp4();
    assert.ok(html.includes('src="data:image/png;base64,TEST"'));

    const data = mapCommercialQuoteToTemplateData({
      referenceCode: REF,
      createdAt: CREATED,
      snapshot: snapshotFor({}),
    });
    const def = renderCommercialQuoteHtml(data);
    assert.match(
      def,
      /<img alt="FarmaFácil" src="data:image\/svg\+xml;base64,[A-Za-z0-9+/=]{80,}"/
    );
    assert.equal(/farmafacil-logo-512\.png/.test(def), false);
  });

  it('formatQuoteEur agrupa miles siempre', () => {
    assert.equal(formatQuoteEur(326216), '3.262,16 €');
    assert.equal(formatQuoteEur(109000), '1.090,00 €');
    assert.equal(formatQuoteEur(0), '0,00 €');
    assert.equal(formatQuoteEur(100000000), '1.000.000,00 €');
  });
});
