/**
 * Extracción / normalización / comparación de presupuestos PDF.
 * Puro (sin I/O). La IA no autoriza cambios: solo propone valores.
 */

export type QuotePdfLineExtract = {
  materialKey: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  unitPriceCents: number | null;
  discountBps: number | null;
  vatBps: number | null;
  leadDays: number | null;
  sourceHint: string | null;
};

export type QuotePdfExtract = {
  supplierName: string | null;
  supplierTaxId: string | null;
  quoteNumber: string | null;
  quoteDate: string | null;
  title: string | null;
  shippingCents: number | null;
  shippingIncludesVat: boolean | null;
  notes: string | null;
  leadDays: number | null;
  subtotalCents: number | null;
  vatCents: number | null;
  totalCents: number | null;
  lines: QuotePdfLineExtract[];
  warnings: string[];
};

export type FieldDiffKind = 'match' | 'format_only' | 'real_diff' | 'missing_in_pdf';

export type FieldDiff = {
  field: string;
  kind: FieldDiffKind;
  current: string | null;
  pdf: string | null;
};

export function emptyQuotePdfExtract(): QuotePdfExtract {
  return {
    supplierName: null,
    supplierTaxId: null,
    quoteNumber: null,
    quoteDate: null,
    title: null,
    shippingCents: null,
    shippingIncludesVat: null,
    notes: null,
    leadDays: null,
    subtotalCents: null,
    vatCents: null,
    totalCents: null,
    lines: [],
    warnings: [],
  };
}

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeTaxId(value: string | null | undefined): string {
  return (value ?? '').replace(/[\s.\-_/]/g, '').toUpperCase();
}

export function normalizeMoneyCents(
  value: number | string | null | undefined
): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : null;
  }
  const raw = value.trim().replace(/\s/g, '').replace('€', '');
  if (!raw) return null;
  // 1.234,56 → 1234.56 ; 12.50 → 12.50
  let normalized = raw;
  if (/,/.test(raw) && /\./.test(raw)) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (/,/.test(raw)) {
    normalized = raw.replace(',', '.');
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  // Si parece euros (con decimales o valor pequeño) convertir a céntimos
  if (Math.abs(n) < 1_000_000 && String(normalized).includes('.')) {
    return Math.round(n * 100);
  }
  if (Number.isInteger(n) && Math.abs(n) >= 1000) return Math.round(n);
  return Math.round(n * 100);
}

export function formatCentsEu(cents: number | null | undefined): string | null {
  if (cents == null || !Number.isFinite(cents)) return null;
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function compareTextField(
  field: string,
  current: string | null | undefined,
  pdf: string | null | undefined
): FieldDiff {
  if (pdf == null || normalizeText(pdf) === '') {
    return {
      field,
      kind: 'missing_in_pdf',
      current: current?.trim() || null,
      pdf: null,
    };
  }
  const cur = current?.trim() || '';
  if (!cur) {
    return { field, kind: 'match', current: null, pdf: pdf.trim() };
  }
  if (normalizeText(cur) === normalizeText(pdf)) {
    return {
      field,
      kind:
        cur.trim() === pdf.trim() ? 'match' : 'format_only',
      current: cur,
      pdf: pdf.trim(),
    };
  }
  return { field, kind: 'real_diff', current: cur, pdf: pdf.trim() };
}

export function compareMoneyField(
  field: string,
  currentCents: number | null | undefined,
  pdfCents: number | null | undefined
): FieldDiff {
  if (pdfCents == null) {
    return {
      field,
      kind: 'missing_in_pdf',
      current: formatCentsEu(currentCents ?? null),
      pdf: null,
    };
  }
  if (currentCents == null) {
    return {
      field,
      kind: 'match',
      current: null,
      pdf: formatCentsEu(pdfCents),
    };
  }
  if (Math.round(currentCents) === Math.round(pdfCents)) {
    return {
      field,
      kind: 'match',
      current: formatCentsEu(currentCents),
      pdf: formatCentsEu(pdfCents),
    };
  }
  return {
    field,
    kind: 'real_diff',
    current: formatCentsEu(currentCents),
    pdf: formatCentsEu(pdfCents),
  };
}

export function compareTaxIdField(
  field: string,
  current: string | null | undefined,
  pdf: string | null | undefined
): FieldDiff {
  if (pdf == null || !normalizeTaxId(pdf)) {
    return {
      field,
      kind: 'missing_in_pdf',
      current: current?.trim() || null,
      pdf: null,
    };
  }
  const cur = current?.trim() || '';
  if (!cur) {
    return { field, kind: 'match', current: null, pdf: pdf.trim() };
  }
  if (normalizeTaxId(cur) === normalizeTaxId(pdf)) {
    return {
      field,
      kind: cur === pdf.trim() ? 'match' : 'format_only',
      current: cur,
      pdf: pdf.trim(),
    };
  }
  return { field, kind: 'real_diff', current: cur, pdf: pdf.trim() };
}

/** Detecta si el PDF parece de otro proveedor/número. */
export function detectIdentityMismatch(input: {
  currentSupplierName?: string | null;
  currentSupplierTaxId?: string | null;
  currentQuoteNumber?: string | null;
  extract: QuotePdfExtract;
}): { mismatch: boolean; messages: string[] } {
  const messages: string[] = [];
  const tax = compareTaxIdField(
    'supplierTaxId',
    input.currentSupplierTaxId,
    input.extract.supplierTaxId
  );
  if (
    tax.kind === 'real_diff' &&
    input.currentSupplierTaxId &&
    input.extract.supplierTaxId
  ) {
    messages.push(
      `CIF/NIF del PDF (${input.extract.supplierTaxId}) no coincide con el proveedor actual (${input.currentSupplierTaxId}).`
    );
  }
  const name = compareTextField(
    'supplierName',
    input.currentSupplierName,
    input.extract.supplierName
  );
  if (
    name.kind === 'real_diff' &&
    input.currentSupplierName &&
    input.extract.supplierName
  ) {
    messages.push(
      `Proveedor del PDF («${input.extract.supplierName}») no coincide con «${input.currentSupplierName}».`
    );
  }
  const num = compareTextField(
    'quoteNumber',
    input.currentQuoteNumber,
    input.extract.quoteNumber
  );
  if (
    num.kind === 'real_diff' &&
    input.currentQuoteNumber &&
    input.extract.quoteNumber
  ) {
    messages.push(
      `N.º de presupuesto del PDF (${input.extract.quoteNumber}) no coincide con el actual (${input.currentQuoteNumber}).`
    );
  }
  return { mismatch: messages.length > 0, messages };
}

export function parseExtractJson(raw: string): QuotePdfExtract {
  const base = emptyQuotePdfExtract();
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) {
      return { ...base, warnings: ['Respuesta IA sin JSON válido'] };
    }
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
    const linesRaw = Array.isArray(parsed.lines) ? parsed.lines : [];
    const lines: QuotePdfLineExtract[] = linesRaw.map((row) => {
      const r = (row ?? {}) as Record<string, unknown>;
      return {
        materialKey:
          r.materialKey == null ? null : String(r.materialKey).trim() || null,
        description:
          r.description == null ? null : String(r.description).trim() || null,
        quantity:
          r.quantity == null || r.quantity === ''
            ? null
            : Number(r.quantity),
        unit: r.unit == null ? null : String(r.unit).trim() || null,
        unitPriceCents: normalizeMoneyCents(
          (r.unitPriceCents as number | string | null) ??
            (r.unitPrice as number | string | null)
        ),
        discountBps:
          r.discountBps == null || r.discountBps === ''
            ? null
            : Math.round(Number(r.discountBps)),
        vatBps:
          r.vatBps == null || r.vatBps === ''
            ? null
            : Math.round(Number(r.vatBps)),
        leadDays:
          r.leadDays == null || r.leadDays === ''
            ? null
            : Math.round(Number(r.leadDays)),
        sourceHint:
          r.sourceHint == null ? null : String(r.sourceHint).trim() || null,
      };
    });
    return {
      supplierName:
        parsed.supplierName == null
          ? null
          : String(parsed.supplierName).trim() || null,
      supplierTaxId:
        parsed.supplierTaxId == null
          ? null
          : String(parsed.supplierTaxId).trim() || null,
      quoteNumber:
        parsed.quoteNumber == null
          ? null
          : String(parsed.quoteNumber).trim() || null,
      quoteDate:
        parsed.quoteDate == null
          ? null
          : String(parsed.quoteDate).trim() || null,
      title:
        parsed.title == null ? null : String(parsed.title).trim() || null,
      shippingCents: normalizeMoneyCents(
        (parsed.shippingCents as number | string | null) ??
          (parsed.shipping as number | string | null)
      ),
      shippingIncludesVat:
        typeof parsed.shippingIncludesVat === 'boolean'
          ? parsed.shippingIncludesVat
          : null,
      notes:
        parsed.notes == null ? null : String(parsed.notes).trim() || null,
      leadDays:
        parsed.leadDays == null || parsed.leadDays === ''
          ? null
          : Math.round(Number(parsed.leadDays)),
      subtotalCents: normalizeMoneyCents(
        parsed.subtotalCents as number | string | null
      ),
      vatCents: normalizeMoneyCents(parsed.vatCents as number | string | null),
      totalCents: normalizeMoneyCents(
        parsed.totalCents as number | string | null
      ),
      lines,
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings.map((w) => String(w))
        : [],
    };
  } catch {
    return { ...base, warnings: ['No se ha podido interpretar la extracción'] };
  }
}
