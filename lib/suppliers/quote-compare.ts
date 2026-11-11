/**
 * Comparador de presupuestos de proveedores (no comerciales a farmacias).
 * Coste comparable = precio unitario s/IVA + transporte neto proporcional.
 */

/** Helpers locales (espejo de purchase-math) para poder testear el módulo en node:test. */
function roundCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.sign(value) * Math.round(Math.abs(value));
}

function lineNetCents(quantity: number, unitPriceCents: number): number {
  if (!(quantity > 0)) throw new Error('La cantidad debe ser mayor que cero');
  if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
    throw new Error('precio inválido');
  }
  return roundCents(quantity * unitPriceCents);
}

function allocateShippingNetProportional(
  shippingNetCents: number,
  lineNetCentsList: readonly number[]
): number[] {
  const shipping = shippingNetCents;
  if (lineNetCentsList.length === 0) return [];
  if (!(Number.isFinite(shipping) && shipping >= 0)) {
    throw new Error('transporte neto inválido');
  }
  const nets = [...lineNetCentsList];
  const totalNet = nets.reduce((a, b) => a + b, 0);
  if (shipping === 0) return nets.map(() => 0);
  if (totalNet <= 0) {
    const out = nets.map(() => 0);
    out[out.length - 1] = shipping;
    return out;
  }
  const shares = nets.map((n) => roundCents((shipping * n) / totalNet));
  let diff = shipping - shares.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    let idx = 0;
    for (let i = 1; i < nets.length; i++) {
      if (nets[i]! >= nets[idx]!) idx = i;
    }
    shares[idx] = shares[idx]! + diff;
  }
  return shares;
}

type SupplierQuoteStatus =
  | 'recibido'
  | 'en_revision'
  | 'aprobado'
  | 'rechazado'
  | 'caducado'
  | 'archivado';

type SupplierQuoteRow = {
  id: string;
  supplierId: string;
  supplierName: string | null;
  title: string;
  status: SupplierQuoteStatus;
  shippingCents: number | null;
};

type SupplierQuoteLineRow = {
  id: string;
  quoteId: string;
  materialKey: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  vatBps: number;
  leadDays: number | null;
};

export type QuoteCompareMode = 'lines' | 'quotes';

export type QuoteCompareLineOffer = {
  groupKey: string;
  groupLabel: string;
  quoteId: string;
  quoteTitle: string;
  quoteStatus: SupplierQuoteStatus;
  supplierId: string;
  supplierName: string;
  lineId: string;
  materialKey: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  vatBps: number;
  taxCents: number;
  shippingCents: number;
  shippingShareCents: number;
  /** Coste unitario s/IVA con transporte proporcional. */
  unitCostExVatWithShippingCents: number;
  leadDays: number | null;
  lineNetCents: number;
};

export type QuoteCompareFullOffer = {
  quoteId: string;
  quoteTitle: string;
  quoteStatus: SupplierQuoteStatus;
  supplierId: string;
  supplierName: string;
  lineCount: number;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  /** Total s/IVA (base + transporte) para comparar. */
  comparableTotalExVatCents: number;
  /** Coste unitario agregado s/IVA c/ transporte (suma qty). */
  unitCostExVatWithShippingCents: number | null;
  totalQty: number;
  leadDaysMin: number | null;
  leadDaysMax: number | null;
  descriptions: string[];
};

export type QuoteCompareWarning = {
  code: string;
  message: string;
  groupKey?: string;
};

export function normalizeCompareKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Clave de agrupación: material_key si existe; si no, descripción normalizada. */
export function lineEquivalenceKey(line: {
  materialKey?: string | null;
  description?: string | null;
}): string {
  const mk = normalizeCompareKey(line.materialKey ?? '');
  if (mk) return `mk:${mk}`;
  const desc = normalizeCompareKey(line.description ?? '');
  return desc ? `desc:${desc}` : `empty`;
}

export function lineEquivalenceLabel(line: {
  materialKey?: string | null;
  description?: string | null;
}): string {
  const mk = (line.materialKey ?? '').trim();
  if (mk) return mk;
  const desc = (line.description ?? '').trim();
  return desc || 'Sin descripción';
}

export function buildLineOffersForQuote(input: {
  quote: SupplierQuoteRow;
  lines: SupplierQuoteLineRow[];
}): QuoteCompareLineOffer[] {
  const shipping = Math.max(0, input.quote.shippingCents ?? 0);
  const prepared = input.lines
    .filter((l) => l.quantity > 0)
    .map((l) => {
      const net = lineNetCents(l.quantity, l.unitPriceCents);
      const tax = roundCents((net * (l.vatBps || 2100)) / 10000);
      return { line: l, net, tax };
    });
  const shares = allocateShippingNetProportional(
    shipping,
    prepared.map((p) => p.net)
  );

  return prepared.map((p, i) => {
    const share = shares[i] ?? 0;
    return {
      groupKey: lineEquivalenceKey(p.line),
      groupLabel: lineEquivalenceLabel(p.line),
      quoteId: input.quote.id,
      quoteTitle: input.quote.title,
      quoteStatus: input.quote.status,
      supplierId: input.quote.supplierId,
      supplierName: input.quote.supplierName ?? '—',
      lineId: p.line.id,
      materialKey: p.line.materialKey,
      description: p.line.description,
      quantity: p.line.quantity,
      unitPriceCents: p.line.unitPriceCents,
      vatBps: p.line.vatBps || 2100,
      taxCents: p.tax,
      shippingCents: shipping,
      shippingShareCents: share,
      unitCostExVatWithShippingCents: roundCents(
        (p.net + share) / p.line.quantity
      ),
      leadDays: p.line.leadDays,
      lineNetCents: p.net,
    };
  });
}

export function buildFullQuoteOffer(input: {
  quote: SupplierQuoteRow;
  lines: SupplierQuoteLineRow[];
}): QuoteCompareFullOffer {
  const lineOffers = buildLineOffersForQuote(input);
  const subtotalCents = lineOffers.reduce((a, o) => a + o.lineNetCents, 0);
  const taxCents = lineOffers.reduce((a, o) => a + o.taxCents, 0);
  const shippingCents = Math.max(0, input.quote.shippingCents ?? 0);
  const totalQty = lineOffers.reduce((a, o) => a + o.quantity, 0);
  const leads = lineOffers
    .map((o) => o.leadDays)
    .filter((d): d is number => d != null && Number.isFinite(d));
  return {
    quoteId: input.quote.id,
    quoteTitle: input.quote.title,
    quoteStatus: input.quote.status,
    supplierId: input.quote.supplierId,
    supplierName: input.quote.supplierName ?? '—',
    lineCount: lineOffers.length,
    subtotalCents,
    taxCents,
    shippingCents,
    comparableTotalExVatCents: subtotalCents + shippingCents,
    unitCostExVatWithShippingCents:
      totalQty > 0
        ? roundCents((subtotalCents + shippingCents) / totalQty)
        : null,
    totalQty,
    leadDaysMin: leads.length ? Math.min(...leads) : null,
    leadDaysMax: leads.length ? Math.max(...leads) : null,
    descriptions: lineOffers.map((o) => o.description || o.materialKey || '—'),
  };
}

export function collectLineOffers(
  quotes: SupplierQuoteRow[],
  linesById: Record<string, SupplierQuoteLineRow[]>,
  selectedQuoteIds: readonly string[]
): QuoteCompareLineOffer[] {
  const selected = new Set(selectedQuoteIds);
  const out: QuoteCompareLineOffer[] = [];
  for (const q of quotes) {
    if (!selected.has(q.id)) continue;
    out.push(
      ...buildLineOffersForQuote({
        quote: q,
        lines: linesById[q.id] ?? [],
      })
    );
  }
  return out;
}

export function collectFullQuoteOffers(
  quotes: SupplierQuoteRow[],
  linesById: Record<string, SupplierQuoteLineRow[]>,
  selectedQuoteIds: readonly string[]
): QuoteCompareFullOffer[] {
  const selected = new Set(selectedQuoteIds);
  return quotes
    .filter((q) => selected.has(q.id))
    .map((q) =>
      buildFullQuoteOffer({ quote: q, lines: linesById[q.id] ?? [] })
    );
}

/** Oferta más económica por coste unitario comparable (empate: primera). */
export function cheapestLineOfferId(
  offers: readonly QuoteCompareLineOffer[]
): string | null {
  if (offers.length === 0) return null;
  let best = offers[0]!;
  for (const o of offers) {
    if (
      o.unitCostExVatWithShippingCents < best.unitCostExVatWithShippingCents
    ) {
      best = o;
    }
  }
  return `${best.quoteId}:${best.lineId}`;
}

export function cheapestFullQuoteId(
  offers: readonly QuoteCompareFullOffer[]
): string | null {
  if (offers.length === 0) return null;
  let best = offers[0]!;
  for (const o of offers) {
    if (o.comparableTotalExVatCents < best.comparableTotalExVatCents) {
      best = o;
    }
  }
  return best.quoteId;
}

export function equivalenceWarningsForLines(
  offers: readonly QuoteCompareLineOffer[]
): QuoteCompareWarning[] {
  const warnings: QuoteCompareWarning[] = [];
  const byGroup = new Map<string, QuoteCompareLineOffer[]>();
  for (const o of offers) {
    const list = byGroup.get(o.groupKey) ?? [];
    list.push(o);
    byGroup.set(o.groupKey, list);
  }

  Array.from(byGroup.entries()).forEach(([groupKey, group]) => {
    if (group.length < 2) return;
    const qtys = Array.from(new Set(group.map((o) => o.quantity)));
    if (qtys.length > 1) {
      warnings.push({
        code: 'qty_mismatch',
        groupKey,
        message: `«${group[0]!.groupLabel}»: cantidades distintas (${qtys.join(', ')}). El coste unitario es comparable, pero el volumen no es equivalente.`,
      });
    }
    const descs = Array.from(
      new Set(
        group.map((o) => normalizeCompareKey(o.description || o.materialKey))
      )
    );
    if (descs.length > 1) {
      warnings.push({
        code: 'desc_mismatch',
        groupKey,
        message: `«${group[0]!.groupLabel}»: descripciones o características no idénticas entre ofertas.`,
      });
    }
    const leads = group
      .map((o) => o.leadDays)
      .filter((d): d is number => d != null);
    if (leads.length >= 2 && new Set(leads).size > 1) {
      warnings.push({
        code: 'lead_mismatch',
        groupKey,
        message: `«${group[0]!.groupLabel}»: plazos de entrega distintos (${leads.join(', ')} d).`,
      });
    }
    const ships = group.map((o) => o.shippingCents);
    if (ships.some((s) => s === 0) && ships.some((s) => s > 0)) {
      warnings.push({
        code: 'shipping_mismatch',
        groupKey,
        message: `«${group[0]!.groupLabel}»: algún presupuesto no incluye transporte; el coste comparable puede no ser equivalente.`,
      });
    }
  });

  const singletonGroups = Array.from(byGroup.values()).filter(
    (g) => g.length === 1
  );
  if (offers.length >= 2 && singletonGroups.length === offers.length) {
    warnings.push({
      code: 'no_common_lines',
      message:
        'No hay líneas equivalentes entre los presupuestos seleccionados (ni por clave de material ni por descripción). Compara presupuestos completos o revisa las líneas.',
    });
  }

  return warnings;
}

export function equivalenceWarningsForQuotes(
  offers: readonly QuoteCompareFullOffer[]
): QuoteCompareWarning[] {
  const warnings: QuoteCompareWarning[] = [];
  if (offers.length < 2) return warnings;
  const lineCounts = Array.from(new Set(offers.map((o) => o.lineCount)));
  if (lineCounts.length > 1) {
    warnings.push({
      code: 'line_count_mismatch',
      message: `Los presupuestos tienen distinto número de líneas (${lineCounts.join(', ')}). Revisa el alcance antes de decidir.`,
    });
  }
  const qtys = Array.from(new Set(offers.map((o) => o.totalQty)));
  if (qtys.length > 1) {
    warnings.push({
      code: 'total_qty_mismatch',
      message: `Cantidades totales distintas (${qtys.join(', ')}). El total comparable no implica el mismo volumen.`,
    });
  }
  const ships = offers.map((o) => o.shippingCents);
  if (ships.some((s) => s === 0) && ships.some((s) => s > 0)) {
    warnings.push({
      code: 'shipping_mismatch',
      message:
        'Algunos presupuestos no incluyen transporte; compara con precaución.',
    });
  }
  return warnings;
}

/** Filtra ofertas de línea por clave de material legacy (URL ?material=). */
export function filterLineOffersByMaterialKey(
  offers: readonly QuoteCompareLineOffer[],
  materialKey: string
): QuoteCompareLineOffer[] {
  const key = normalizeCompareKey(materialKey);
  if (!key) return [...offers];
  return offers.filter(
    (o) =>
      normalizeCompareKey(o.materialKey) === key ||
      o.groupKey === `mk:${key}` ||
      o.groupKey === `desc:${key}`
  );
}
