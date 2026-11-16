import type { CommercialQuoteSnapshot } from '../commercial/quote-types';

import { formatCentsEs, formatVatPercent, intervalLabel } from './money';
import { commercialOfferLabel } from './offer-label';
import type { ContractCommercialAmounts } from './types';

/** Alquiler según periodicidad del snapshot (anual: total periodo + equivalencia mensual). */
export function formatKioskRentFromSnapshot(
  snapshot: CommercialQuoteSnapshot
): string {
  const count = Math.max(0, Number(snapshot.kioskCount) || 0);
  if (count === 0) return formatCentsEs(0);
  const monthlyTotal =
    (Number(snapshot.kioskLicenseMonthlyCents) || 0) * count;
  const periodTotal =
    Number(snapshot.breakdown.kioskLicenseRecurringCents) || monthlyTotal;
  if (snapshot.interval === 'annual') {
    return `${formatCentsEs(periodTotal)}/año (${formatCentsEs(monthlyTotal)}/mes)`;
  }
  return `${formatCentsEs(periodTotal)}/mes`;
}

/**
 * Importes solo desde el snapshot del presupuesto.
 * No usa cifras hardcodeadas de plantillas Word.
 */
export function amountsFromAcceptedSnapshot(input: {
  quoteId: string;
  quoteReference: string | null;
  snapshot: CommercialQuoteSnapshot;
}): ContractCommercialAmounts {
  const s = input.snapshot;
  const snapshotVersion = typeof s.v === 'number' ? s.v : 1;
  const offerLabel = commercialOfferLabel({
    planId: s.planId,
    planName: s.planName,
    kioskCount: s.kioskCount,
  });
  const formatted: Record<string, string> = {
    PLAN_NOMBRE: offerLabel,
    PERIODICIDAD: intervalLabel(s.interval),
    COHORTE_PRICING: String(s.cohortPricing ?? '—'),
    CUOTA_RECURRENTE: formatCentsEs(s.breakdown.recurringNetCents),
    CUOTA_RECURRENTE_IVA: formatCentsEs(s.breakdown.recurringGrossCents),
    CUOTA_ALTA: s.includeAppSignupFee
      ? formatCentsEs(s.appSignupFeeCents)
      : formatCentsEs(0),
    PERSONALIZACION_KIOSCO: formatCentsEs(s.hardwareCents),
    PERSONALIZACION_KIOSCO_UNITARIA: formatCentsEs(s.hardwareUnitCents),
    ALQUILER_KIOSCO: formatKioskRentFromSnapshot(s),
    ALQUILER_KIOSCO_UNITARIO: formatCentsEs(s.kioskLicenseMonthlyCents),
    INSTALACION: s.onsiteInstallIncluded
      ? 'Incluida según presupuesto (sin importe adicional en snapshot)'
      : 'No incluida',
    NUM_KIOSCOS: String(s.kioskCount),
    PRESUPUESTO_REF: input.quoteReference?.trim() || input.quoteId,
    PRESUPUESTO_ID: input.quoteId,
    PRESUPUESTO_SNAPSHOT_VERSION: String(snapshotVersion),
    IVA_PCT: formatVatPercent(s.vatBps),
    PAGO_UNICO_NETO: formatCentsEs(s.breakdown.oneTimeNetCents),
    PAGO_UNICO_IVA: formatCentsEs(s.breakdown.oneTimeGrossCents),
    PLAN_RECURRENTE: formatCentsEs(s.breakdown.planRecurringCents),
  };

  return {
    quoteId: input.quoteId,
    quoteReference: input.quoteReference,
    snapshotVersion,
    planId: s.planId,
    planName: s.planName,
    interval: s.interval,
    cohortPricing: String(s.cohortPricing ?? ''),
    kioskCount: s.kioskCount,
    onsiteInstallIncluded: s.onsiteInstallIncluded,
    includeAppSignupFee: s.includeAppSignupFee,
    appSignupFeeCents: s.appSignupFeeCents,
    hardwareUnitCents: s.hardwareUnitCents,
    hardwareCents: s.hardwareCents,
    kioskLicenseMonthlyCents: s.kioskLicenseMonthlyCents,
    vatBps: s.vatBps,
    recurringNetCents: s.breakdown.recurringNetCents,
    recurringGrossCents: s.breakdown.recurringGrossCents,
    oneTimeNetCents: s.breakdown.oneTimeNetCents,
    oneTimeGrossCents: s.breakdown.oneTimeGrossCents,
    formatted,
  };
}
