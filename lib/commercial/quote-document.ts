import {
  calculateQuote,
  formatCentsEur,
  getPlan,
  KIOSK_USAGE_FEE_LABEL_ES,
  type BillingInterval,
  type CommercialPlanId,
  type CommercialTariffConfig,
  type SaasCohortPricing,
  type SimulatorBreakdown,
} from '@/lib/tarifas';
import { commercialPlanLabel } from '@/lib/commercial/commercial-plan-labels';
import {
  QUOTE_LOGO_PUBLIC_PATH,
  renderCommercialQuoteHtmlFromSnapshot,
} from '@/lib/commercial/quote-template-html';
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
    planName: commercialPlanLabel(plan.id) || plan.name,
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
      description: `${KIOSK_USAGE_FEE_LABEL_ES} (${snapshot.kioskCount}) / ${period}`,
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

/**
 * HTML corporativo PRE-05 (plantilla aprobada). Importes: snapshot guardado.
 * En servidor incrusta el logo oficial como data URI.
 */
export function buildQuoteDocumentHtml(input: {
  referenceCode: string | null;
  createdAt: string;
  snapshot: CommercialQuoteSnapshot;
  config?: CommercialTariffConfig;
}): string {
  return renderCommercialQuoteHtmlFromSnapshot(input);
}

/** Abre el documento en una ventana para imprimir / guardar como PDF. */
export function openQuotePrintWindow(html: string): void {
  html = absolutizeQuoteLogo(html);
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
  html = absolutizeQuoteLogo(html);
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

/** Si el HTML usa la ruta pública del logo (sin data URI), la hace absoluta. */
function absolutizeQuoteLogo(html: string): string {
  if (typeof window === 'undefined') return html;
  return html.replace(
    `src="${QUOTE_LOGO_PUBLIC_PATH}"`,
    `src="${window.location.origin}${QUOTE_LOGO_PUBLIC_PATH}"`
  );
}
