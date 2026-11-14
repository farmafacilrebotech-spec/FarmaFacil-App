/**
 * PDF corporativo de presupuesto comercial (A4, servidor).
 * Misma fuente de importes que el snapshot / motor comercial.
 * Sin instrucciones de impresión ni elementos de UI.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { jsPDF } from 'jspdf';

import {
  buildCommercialYearProjection,
  formatBpsPercent,
  formatCentsEur,
  KIOSK_USAGE_FEE_LABEL_ES,
  TARIFF_REVISION_NOTE_ES,
  DEFAULT_COMMERCIAL_TARIFF_CONFIG,
  type CommercialPlanId,
  type SelectableCommercialOffer,
} from '@/lib/tarifas';
import type { CommercialQuoteSnapshot } from '@/lib/commercial/quote-types';
import { commercialPlanLabel } from '@/lib/commercial/commercial-plan-labels';

const COLOR = {
  black: [11, 11, 11] as [number, number, number],
  turquoise: [26, 187, 179] as [number, number, number],
  silver: [197, 204, 211] as [number, number, number],
  muted: [100, 110, 120] as [number, number, number],
};

export type CommercialQuotePdfInput = {
  referenceCode: string;
  createdAt: string;
  snapshot: CommercialQuoteSnapshot;
};

export type CommercialQuotePdfResult = {
  bytes: Uint8Array;
  filename: string;
  mimeType: 'application/pdf';
};

function formatDateEs(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function offerFromSnapshot(
  snapshot: CommercialQuoteSnapshot
): SelectableCommercialOffer {
  if (snapshot.cohortPricing === 'launch_2027') return 'launch_2027';
  return 'normal';
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const filePath = path.join(
      process.cwd(),
      'public',
      'images',
      'logos',
      'farmafacil-logo-512.png'
    );
    const buf = await readFile(filePath);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Genera el PDF A4 del presupuesto a partir del snapshot inmutable.
 */
export async function buildCommercialQuotePdf(
  input: CommercialQuotePdfInput
): Promise<CommercialQuotePdfResult> {
  const s = input.snapshot;
  const ref = input.referenceCode.trim() || 'sin-ref';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  let y = 14;

  const logo = await loadLogoDataUrl();
  if (logo) {
    const logoSize = 18;
    doc.addImage(logo, 'PNG', margin, y, logoSize, logoSize);
    doc.setDrawColor(...COLOR.turquoise);
    doc.setLineWidth(0.4);
    doc.circle(margin + logoSize / 2, y + logoSize / 2, logoSize / 2 + 0.6);
  }

  doc.setTextColor(...COLOR.black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('FarmaFácil', logo ? margin + 22 : margin, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLOR.turquoise);
  doc.text('Presupuesto comercial', logo ? margin + 22 : margin, y + 13);
  y += 24;

  doc.setDrawColor(...COLOR.silver);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setTextColor(...COLOR.muted);
  doc.setFontSize(9);
  doc.text(`Referencia ${ref}`, margin, y);
  doc.text(`Fecha ${formatDateEs(input.createdAt)}`, pageW / 2, y);
  y += 5;
  doc.text(
    `Vigencia hasta ${s.validUntil ? formatDateEs(s.validUntil) : '—'}`,
    margin,
    y
  );
  doc.text(
    `Facturación ${s.interval === 'monthly' ? 'mensual' : 'anual'}`,
    pageW / 2,
    y
  );
  y += 10;

  doc.setTextColor(...COLOR.black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Farmacia y contacto', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(s.clientName || '—', margin, y);
  y += 5;
  doc.setTextColor(...COLOR.muted);
  doc.text(
    `${s.contactName || '—'} · ${s.contactEmail || '—'}`,
    margin,
    y
  );
  y += 10;

  const planLabel = commercialPlanLabel(s.planId) || s.planName;
  doc.setTextColor(...COLOR.black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Plan y modalidad', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(
    `${planLabel} · Oferta ${
      s.cohortPricing === 'launch_2027'
        ? 'Lanzamiento 2027'
        : s.cohortPricing === 'cohort_2027_in_2028'
          ? 'Histórica 2028 (−30 %)'
          : 'Tarifa normal'
    }`,
    margin,
    y
  );
  y += 5;
  doc.setTextColor(...COLOR.muted);
  doc.text(`IVA aplicable: ${formatBpsPercent(s.vatBps)}`, margin, y);
  y += 10;

  doc.setTextColor(...COLOR.black);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Pagos iniciales', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const oneTimeRows: [string, string][] = [];
  if (s.appSignupFeeCents > 0) {
    oneTimeRows.push([
      'Alta de la aplicación (pago único)',
      formatCentsEur(s.appSignupFeeCents),
    ]);
  }
  if (s.hardwareCents > 0) {
    oneTimeRows.push([
      `Personalización kiosko (${s.kioskCount} ud.)`,
      formatCentsEur(s.hardwareCents),
    ]);
  }
  oneTimeRows.push([
    s.onsiteInstallIncluded
      ? 'Instalación presencial (incluida · sin importe)'
      : 'Instalación presencial (no incluida)',
    '0,00 €',
  ]);
  oneTimeRows.push(['Total pagos iniciales (neto)', formatCentsEur(s.breakdown.oneTimeNetCents)]);
  oneTimeRows.push(['Impuestos', formatCentsEur(s.breakdown.oneTimeVatCents)]);
  oneTimeRows.push([
    'Total pagos iniciales con impuestos',
    formatCentsEur(s.breakdown.oneTimeGrossCents),
  ]);

  for (const [label, amount] of oneTimeRows) {
    doc.setTextColor(...COLOR.black);
    doc.text(label, margin, y);
    doc.text(amount, pageW - margin, y, { align: 'right' });
    y += 5;
  }
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Suscripciones', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const period = s.interval === 'monthly' ? 'mes' : 'año';
  const subRows: [string, string][] = [
    [
      `Cuota SaaS plan ${planLabel} / ${period}`,
      formatCentsEur(s.breakdown.planRecurringCents),
    ],
  ];
  if (s.kioskCount > 0) {
    subRows.push([
      `${KIOSK_USAGE_FEE_LABEL_ES} (${s.kioskCount}) / ${period}`,
      formatCentsEur(s.breakdown.kioskLicenseRecurringCents),
    ]);
  }
  subRows.push([
    `Recurrente neto / ${period}`,
    formatCentsEur(s.breakdown.recurringNetCents),
  ]);
  subRows.push([
    `Recurrente con impuestos / ${period}`,
    formatCentsEur(s.breakdown.recurringGrossCents),
  ]);

  for (const [label, amount] of subRows) {
    doc.setTextColor(...COLOR.black);
    doc.text(label, margin, y, { maxWidth: pageW - margin * 2 - 40 });
    doc.text(amount, pageW - margin, y, { align: 'right' });
    y += 5;
  }
  y += 6;

  // Evolución 2027–2029 (misma fuente de cálculo)
  if (s.planId !== 'pilot') {
    if (y > 220) {
      doc.addPage();
      y = 16;
    }
    const planId = s.planId as CommercialPlanId;
    const projection = buildCommercialYearProjection(
      DEFAULT_COMMERCIAL_TARIFF_CONFIG,
      {
        planId,
        offer: offerFromSnapshot(s),
        interval: s.interval,
        kioskCount: s.kioskCount,
        onsiteInstallIncluded: s.onsiteInstallIncluded,
        includeAppSignupFee: s.includeAppSignupFee,
      }
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLOR.black);
    doc.text('Evolución económica 2027–2029', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.muted);
    doc.text(
      'Descuentos de lanzamiento por año natural. Coste anualizado ≠ calendario real de cobros.',
      margin,
      y,
      { maxWidth: pageW - margin * 2 }
    );
    y += 7;

    for (const row of projection.rows) {
      if (y > 250) {
        doc.addPage();
        y = 16;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...COLOR.turquoise);
      doc.text(row.label, margin, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR.black);
      doc.setFontSize(8);
      const lines: [string, string][] = [
        [
          'Descuento SaaS',
          `${(row.saasDiscountBps / 100).toFixed(0)} %`,
        ],
        ['Cuota mensual SaaS', formatCentsEur(row.saasMonthlyCents)],
        [
          'Cuota mensual de uso del kiosko FarmaFácil',
          formatCentsEur(row.kioskMonthlyCents),
        ],
        ['Recurrente mensual', formatCentsEur(row.recurringMonthlyCents)],
        ['Recurrente anual', formatCentsEur(row.recurringAnnualCents)],
        ['Pagos iniciales', formatCentsEur(row.oneTimeNetCents)],
        ['Total sin IVA', formatCentsEur(row.yearNetCents)],
        ['Impuestos aplicables', formatCentsEur(row.yearVatCents)],
        ['Total con impuestos', formatCentsEur(row.yearGrossCents)],
      ];
      for (const [label, amount] of lines) {
        doc.text(label, margin + 2, y);
        doc.text(amount, pageW - margin, y, { align: 'right' });
        y += 4;
      }
      y += 3;
    }

    doc.setTextColor(...COLOR.muted);
    doc.setFontSize(8);
    const noteLines = doc.splitTextToSize(
      TARIFF_REVISION_NOTE_ES,
      pageW - margin * 2
    );
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4 + 4;
  }

  if (s.commercialConditions?.length) {
    if (y > 240) {
      doc.addPage();
      y = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLOR.black);
    doc.text('Condiciones comerciales', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const c of s.commercialConditions) {
      const wrapped = doc.splitTextToSize(`• ${c}`, pageW - margin * 2);
      if (y + wrapped.length * 4 > 280) {
        doc.addPage();
        y = 16;
      }
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4 + 1;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...COLOR.silver);
    doc.text(
      `FarmaFácil · Presupuesto ${ref} · Página ${i} de ${pageCount}`,
      pageW / 2,
      290,
      { align: 'center' }
    );
  }

  const arrayBuffer = doc.output('arraybuffer');
  return {
    bytes: new Uint8Array(arrayBuffer),
    filename: `presupuesto-${ref}.pdf`,
    mimeType: 'application/pdf',
  };
}

export function pdfBytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}
