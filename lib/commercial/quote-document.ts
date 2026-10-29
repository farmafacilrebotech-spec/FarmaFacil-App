import {
  calculateQuote,
  formatCentsEur,
  formatBpsPercent,
  getPlan,
  type BillingInterval,
  type CommercialPlanId,
  type CommercialTariffConfig,
  type SaasCohortPricing,
  type SimulatorBreakdown,
} from '@/lib/tarifas';
import {
  DEFAULT_COMMERCIAL_CONDITIONS,
  DEFAULT_QUOTE_VALIDITY_DAYS,
  type CommercialQuoteLineInput,
  type CommercialQuoteSnapshot,
} from '@/lib/commercial/quote-types';

export type BuildQuoteDocumentInput = {
  config: CommercialTariffConfig;
  clientName: string;
  contactName: string;
  contactEmail: string;
  pharmacyId: string | null;
  pharmacyName: string | null;
  planId: CommercialPlanId;
  interval: BillingInterval;
  cohortPricing: SaasCohortPricing;
  kioskCount: number;
  onsiteInstallIncluded: boolean;
  notes?: string | null;
  validUntil?: string | null;
  validityDays?: number;
};

export function defaultValidUntilIso(
  days = DEFAULT_QUOTE_VALIDITY_DAYS
): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildQuoteBreakdown(
  input: BuildQuoteDocumentInput
): SimulatorBreakdown {
  const isPilot = input.planId === 'pilot';
  return calculateQuote(input.config, {
    planId: input.planId,
    interval: input.interval,
    kioskCount: isPilot ? 0 : input.kioskCount,
    onsiteInstallIncluded: isPilot ? false : input.onsiteInstallIncluded,
    cohortPricing: isPilot ? 'normal' : input.cohortPricing,
    includeAppSignupFee: !isPilot,
  });
}

export function buildCommercialQuoteSnapshot(
  input: BuildQuoteDocumentInput,
  breakdown?: SimulatorBreakdown
): CommercialQuoteSnapshot {
  const quote = breakdown ?? buildQuoteBreakdown(input);
  const plan = getPlan(input.config, input.planId);
  const validUntil =
    input.validUntil?.trim() ||
    defaultValidUntilIso(input.validityDays ?? DEFAULT_QUOTE_VALIDITY_DAYS);

  return {
    v: 1,
    clientName: input.clientName.trim(),
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    pharmacyId: input.pharmacyId,
    pharmacyName: input.pharmacyName,
    planId: plan.id,
    planName: plan.name,
    interval: quote.interval,
    cohortPricing: quote.cohortPricing,
    kioskCount: quote.kioskCount,
    onsiteInstallIncluded: quote.onsiteInstallIncluded,
    includeAppSignupFee: quote.appSignupFeeCents > 0,
    appSignupFeeCents: quote.appSignupFeeCents,
    hardwareUnitCents: input.config.kioskHardwareUnitCents,
    hardwareCents: quote.hardwareCents,
    kioskLicenseMonthlyCents: input.config.kioskLicenseMonthlyCents,
    vatBps: input.config.vatBps,
    saasAnnualDiscountBps: input.config.saasAnnualDiscountBps,
    notes: input.notes?.trim() || null,
    validUntil,
    commercialConditions: [...DEFAULT_COMMERCIAL_CONDITIONS],
    breakdown: {
      oneTimeNetCents: quote.oneTimeNetCents,
      oneTimeVatCents: quote.oneTimeVatCents,
      oneTimeGrossCents: quote.oneTimeGrossCents,
      planRecurringCents: quote.planRecurringCents,
      kioskLicenseRecurringCents: quote.kioskLicenseRecurringCents,
      recurringNetCents: quote.recurringNetCents,
      recurringVatCents: quote.recurringVatCents,
      recurringGrossCents: quote.recurringGrossCents,
      firstYearSubscriptionCents: quote.firstYearSubscriptionCents,
      firstYearNetCents: quote.firstYearNetCents,
      firstYearVatCents: quote.firstYearVatCents,
      firstYearGrossCents: quote.firstYearGrossCents,
      laterYearsRecurringNetCents: quote.laterYearsRecurringNetCents,
    },
  };
}

export function buildCommercialQuoteLines(
  snapshot: CommercialQuoteSnapshot
): CommercialQuoteLineInput[] {
  const lines: CommercialQuoteLineInput[] = [];
  let order = 0;
  const period = snapshot.interval === 'monthly' ? 'mes' : 'año';

  if (snapshot.appSignupFeeCents > 0) {
    lines.push({
      lineType: 'other',
      description: 'Alta de la aplicación (pago único)',
      quantity: 1,
      unitCents: snapshot.appSignupFeeCents,
      lineNetCents: snapshot.appSignupFeeCents,
      sortOrder: order++,
      metadata: { kind: 'app_signup' },
    });
  }

  if (snapshot.kioskCount > 0 && snapshot.hardwareCents > 0) {
    const unit =
      snapshot.kioskCount > 0
        ? Math.round(snapshot.hardwareCents / snapshot.kioskCount)
        : snapshot.hardwareUnitCents;
    lines.push({
      lineType: 'kiosk_hardware',
      description: `Personalización kiosko (${snapshot.kioskCount} × ${formatCentsEur(unit)})`,
      quantity: snapshot.kioskCount,
      unitCents: unit,
      lineNetCents: snapshot.hardwareCents,
      sortOrder: order++,
    });
  }

  lines.push({
    lineType: 'onsite_install',
    description: snapshot.onsiteInstallIncluded
      ? 'Instalación presencial (incluida · sin importe)'
      : 'Instalación presencial (no incluida)',
    quantity: 1,
    unitCents: 0,
    lineNetCents: 0,
    sortOrder: order++,
    metadata: { included: snapshot.onsiteInstallIncluded },
  });

  if (!snapshot.planId || snapshot.planId === 'pilot') {
    lines.push({
      lineType: 'plan',
      description: `${snapshot.planName} · piloto 15 días (0 €)`,
      quantity: 1,
      unitCents: 0,
      lineNetCents: 0,
      sortOrder: order++,
      metadata: { interval: snapshot.interval },
    });
  } else {
    lines.push({
      lineType: 'plan',
      description: `Plan ${snapshot.planName} (SaaS / ${period})`,
      quantity: 1,
      unitCents: snapshot.breakdown.planRecurringCents,
      lineNetCents: snapshot.breakdown.planRecurringCents,
      sortOrder: order++,
      metadata: { interval: snapshot.interval, cohort: snapshot.cohortPricing },
    });
  }

  if (snapshot.kioskCount > 0) {
    lines.push({
      lineType: 'kiosk_license',
      description: `Alquiler kiosko (${snapshot.kioskCount}) / ${period}`,
      quantity: snapshot.kioskCount,
      unitCents:
        snapshot.kioskCount > 0
          ? Math.round(
              snapshot.breakdown.kioskLicenseRecurringCents / snapshot.kioskCount
            )
          : snapshot.kioskLicenseMonthlyCents,
      lineNetCents: snapshot.breakdown.kioskLicenseRecurringCents,
      sortOrder: order++,
      metadata: { interval: snapshot.interval },
    });
  }

  return lines;
}

export function buildQuoteDocumentHtml(input: {
  referenceCode: string | null;
  createdAt: string;
  snapshot: CommercialQuoteSnapshot;
}): string {
  const { snapshot: s } = input;
  const period = s.interval === 'monthly' ? 'mes' : 'año';
  const ref = input.referenceCode?.trim() || 'sin referencia';
  const created = formatDateEs(input.createdAt);
  const validUntil = s.validUntil ? formatDateEs(s.validUntil) : '—';

  const rows = [
    s.appSignupFeeCents > 0
      ? tr(
          'Alta de la aplicación (pago único)',
          '1',
          formatCentsEur(s.appSignupFeeCents),
          formatCentsEur(s.appSignupFeeCents)
        )
      : '',
    s.hardwareCents > 0
      ? tr(
          `Personalización kiosko (${s.kioskCount} ud.)`,
          String(s.kioskCount),
          formatCentsEur(
            s.kioskCount > 0
              ? Math.round(s.hardwareCents / s.kioskCount)
              : s.hardwareUnitCents
          ),
          formatCentsEur(s.hardwareCents)
        )
      : '',
    tr(
      s.onsiteInstallIncluded
        ? 'Instalación presencial (incluida)'
        : 'Instalación presencial (no incluida)',
      '—',
      '0,00 €',
      '0,00 €'
    ),
    tr(
      `Plan ${s.planName} (SaaS / ${period})`,
      '1',
      formatCentsEur(s.breakdown.planRecurringCents),
      formatCentsEur(s.breakdown.planRecurringCents)
    ),
    s.kioskCount > 0
      ? tr(
          `Alquiler kiosko / ${period}`,
          String(s.kioskCount),
          formatCentsEur(
            Math.round(
              s.breakdown.kioskLicenseRecurringCents / Math.max(1, s.kioskCount)
            )
          ),
          formatCentsEur(s.breakdown.kioskLicenseRecurringCents)
        )
      : '',
  ]
    .filter(Boolean)
    .join('');

  const conditions = s.commercialConditions
    .map((c) => `<li>${escapeHtml(c)}</li>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Presupuesto FarmaFácil ${escapeHtml(ref)}</title>
<style>
  @page { margin: 18mm; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 12px; line-height: 1.45; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 22px 0 8px; }
  .muted { color: #6b7280; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-top: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border-bottom: 1px solid #e5e7eb; padding: 8px 6px; text-align: left; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals { margin-top: 16px; width: 100%; max-width: 360px; margin-left: auto; }
  .totals td { border: 0; padding: 4px 0; }
  .totals .strong { font-weight: 700; font-size: 13px; }
  ul { padding-left: 18px; }
  .footer { margin-top: 28px; font-size: 11px; color: #6b7280; }
  @media print {
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <p class="no-print muted">Usa «Guardar como PDF» o «Imprimir → PDF» en el diálogo del sistema.</p>
  <h1>Presupuesto comercial FarmaFácil</h1>
  <p class="muted">Referencia ${escapeHtml(ref)} · Creado ${escapeHtml(created)} · Vigencia hasta ${escapeHtml(validUntil)}</p>

  <div class="meta">
    <div><strong>Farmacia / cliente</strong><br/>${escapeHtml(s.clientName || '—')}</div>
    <div><strong>Contacto</strong><br/>${escapeHtml(s.contactName || '—')}<br/>${escapeHtml(s.contactEmail || '—')}</div>
    <div><strong>Plan</strong><br/>${escapeHtml(s.planName)} · ${s.interval === 'monthly' ? 'Mensual' : 'Anual'}</div>
    <div><strong>IVA</strong><br/>${escapeHtml(formatBpsPercent(s.vatBps))}</div>
  </div>

  <h2>Conceptos</h2>
  <table>
    <thead>
      <tr>
        <th>Concepto</th>
        <th class="num">Cant.</th>
        <th class="num">Precio</th>
        <th class="num">Importe</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <table class="totals">
    <tr><td>Pago inicial neto</td><td class="num">${escapeHtml(formatCentsEur(s.breakdown.oneTimeNetCents))}</td></tr>
    <tr><td>IVA pago inicial</td><td class="num">${escapeHtml(formatCentsEur(s.breakdown.oneTimeVatCents))}</td></tr>
    <tr class="strong"><td>Pago inicial con IVA</td><td class="num">${escapeHtml(formatCentsEur(s.breakdown.oneTimeGrossCents))}</td></tr>
    <tr><td>Cuota recurrente neta / ${period}</td><td class="num">${escapeHtml(formatCentsEur(s.breakdown.recurringNetCents))}</td></tr>
    <tr><td>IVA cuota / ${period}</td><td class="num">${escapeHtml(formatCentsEur(s.breakdown.recurringVatCents))}</td></tr>
    <tr class="strong"><td>Cuota con IVA / ${period}</td><td class="num">${escapeHtml(formatCentsEur(s.breakdown.recurringGrossCents))}</td></tr>
    <tr><td>Total año 1 neto</td><td class="num">${escapeHtml(formatCentsEur(s.breakdown.firstYearNetCents))}</td></tr>
    <tr class="strong"><td>Total año 1 con IVA</td><td class="num">${escapeHtml(formatCentsEur(s.breakdown.firstYearGrossCents))}</td></tr>
  </table>

  ${
    s.notes
      ? `<h2>Notas</h2><p>${escapeHtml(s.notes)}</p>`
      : ''
  }

  <h2>Condiciones comerciales</h2>
  <ul>${conditions}</ul>

  <p class="footer">
    Documento informativo. No constituye factura ni contrato firmado.
    La aceptación no activa servicios ni el piloto de 15 días.
  </p>
</body>
</html>`;
}

function tr(
  concept: string,
  qty: string,
  unit: string,
  amount: string
): string {
  return `<tr>
    <td>${escapeHtml(concept)}</td>
    <td class="num">${escapeHtml(qty)}</td>
    <td class="num">${escapeHtml(unit)}</td>
    <td class="num">${escapeHtml(amount)}</td>
  </tr>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateEs(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Abre el documento en una ventana para imprimir / guardar como PDF. */
export function openQuotePrintWindow(html: string): void {
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
  if (!win) {
    throw new Error(
      'No se ha podido abrir la ventana de impresión. Revisa el bloqueo de ventanas emergentes.'
    );
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Esperar estilos antes de imprimir
  win.focus();
  setTimeout(() => {
    try {
      win.print();
    } catch {
      /* el usuario puede imprimir manualmente */
    }
  }, 250);
}

export function downloadQuoteHtmlFile(
  html: string,
  filename: string
): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
