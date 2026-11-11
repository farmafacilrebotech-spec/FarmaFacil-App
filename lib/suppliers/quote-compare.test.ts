/**
 * node --experimental-strip-types --test lib/suppliers/quote-compare.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFullQuoteOffer,
  buildLineOffersForQuote,
  cheapestFullQuoteId,
  cheapestLineOfferId,
  equivalenceWarningsForLines,
  equivalenceWarningsForQuotes,
  filterLineOffersByMaterialKey,
  lineEquivalenceKey,
  normalizeCompareKey,
} from './quote-compare.ts';
import type {
  SupplierQuoteLineRow,
  SupplierQuoteRow,
} from './types.ts';

function quote(
  partial: Partial<SupplierQuoteRow> & Pick<SupplierQuoteRow, 'id' | 'title'>
): SupplierQuoteRow {
  return {
    supplierId: 's1',
    supplierName: 'Proveedor A',
    supplierCategory: 'otros',
    quoteNumber: null,
    status: 'recibido',
    receivedAt: null,
    validUntil: null,
    currency: 'EUR',
    shippingCents: 0,
    notes: null,
    rejectionReason: null,
    createdAt: '',
    updatedAt: null,
    ...partial,
  };
}

function line(
  partial: Partial<SupplierQuoteLineRow> &
    Pick<SupplierQuoteLineRow, 'id' | 'quoteId' | 'description'>
): SupplierQuoteLineRow {
  return {
    materialKey: '',
    quantity: 1,
    unit: null,
    unitPriceCents: 1000,
    vatBps: 2100,
    leadDays: null,
    ...partial,
  };
}

describe('normalize / equivalence keys', () => {
  it('normaliza espacios y mayúsculas', () => {
    assert.equal(normalizeCompareKey('  KSK  Panel '), 'ksk panel');
  });

  it('prioriza material_key sobre descripción', () => {
    assert.equal(
      lineEquivalenceKey({ materialKey: 'ksk-01', description: 'Otro' }),
      'mk:ksk-01'
    );
    assert.equal(
      lineEquivalenceKey({ materialKey: '', description: 'Panel LED' }),
      'desc:panel led'
    );
  });
});

describe('coste comparable por línea', () => {
  it('reparte transporte y calcula unitario s/IVA c/ transporte', () => {
    const offers = buildLineOffersForQuote({
      quote: quote({
        id: 'q1',
        title: 'Oferta A',
        shippingCents: 1000,
      }),
      lines: [
        line({
          id: 'l1',
          quoteId: 'q1',
          materialKey: 'ksk',
          description: 'Kiosko',
          quantity: 1,
          unitPriceCents: 7500,
        }),
        line({
          id: 'l2',
          quoteId: 'q1',
          materialKey: 'acc',
          description: 'Accesorio',
          quantity: 1,
          unitPriceCents: 2500,
        }),
      ],
    });
    assert.equal(offers[0]!.shippingShareCents, 750);
    assert.equal(offers[0]!.unitCostExVatWithShippingCents, 8250);
    assert.equal(offers[1]!.shippingShareCents, 250);
    assert.equal(offers[1]!.unitCostExVatWithShippingCents, 2750);
    assert.equal(offers[0]!.taxCents, roundVat(7500, 2100));
  });

  it('identifica la más económica sin empates forzados', () => {
    const a = buildLineOffersForQuote({
      quote: quote({
        id: 'q1',
        title: 'A',
        supplierId: 's1',
        supplierName: 'A',
        shippingCents: 0,
      }),
      lines: [
        line({
          id: 'l1',
          quoteId: 'q1',
          materialKey: 'x',
          description: 'Item',
          unitPriceCents: 2000,
        }),
      ],
    });
    const b = buildLineOffersForQuote({
      quote: quote({
        id: 'q2',
        title: 'B',
        supplierId: 's2',
        supplierName: 'B',
        shippingCents: 100,
      }),
      lines: [
        line({
          id: 'l2',
          quoteId: 'q2',
          materialKey: 'x',
          description: 'Item',
          unitPriceCents: 1800,
        }),
      ],
    });
    const all = [...a, ...b];
    assert.equal(cheapestLineOfferId(all), 'q2:l2');
  });
});

describe('presupuesto completo', () => {
  it('suma base + transporte como total comparable', () => {
    const full = buildFullQuoteOffer({
      quote: quote({ id: 'q1', title: 'Full', shippingCents: 500 }),
      lines: [
        line({
          id: 'l1',
          quoteId: 'q1',
          description: 'A',
          quantity: 2,
          unitPriceCents: 1000,
        }),
      ],
    });
    assert.equal(full.subtotalCents, 2000);
    assert.equal(full.comparableTotalExVatCents, 2500);
    assert.equal(full.unitCostExVatWithShippingCents, 1250);
    assert.equal(cheapestFullQuoteId([full]), 'q1');
  });
});

describe('advertencias de equivalencia', () => {
  it('avisa cantidades distintas en el mismo grupo', () => {
    const offers = [
      ...buildLineOffersForQuote({
        quote: quote({ id: 'q1', title: 'A', shippingCents: 0 }),
        lines: [
          line({
            id: 'l1',
            quoteId: 'q1',
            materialKey: 'ksk',
            description: 'Kiosko',
            quantity: 1,
          }),
        ],
      }),
      ...buildLineOffersForQuote({
        quote: quote({
          id: 'q2',
          title: 'B',
          supplierId: 's2',
          supplierName: 'B',
          shippingCents: 0,
        }),
        lines: [
          line({
            id: 'l2',
            quoteId: 'q2',
            materialKey: 'ksk',
            description: 'Kiosko',
            quantity: 3,
          }),
        ],
      }),
    ];
    const w = equivalenceWarningsForLines(offers);
    assert.ok(w.some((x) => x.code === 'qty_mismatch'));
  });

  it('avisa presupuestos con distinto nº de líneas', () => {
    const a = buildFullQuoteOffer({
      quote: quote({ id: 'q1', title: 'A' }),
      lines: [line({ id: 'l1', quoteId: 'q1', description: 'Solo' })],
    });
    const b = buildFullQuoteOffer({
      quote: quote({ id: 'q2', title: 'B', supplierId: 's2' }),
      lines: [
        line({ id: 'l2', quoteId: 'q2', description: 'Uno' }),
        line({ id: 'l3', quoteId: 'q2', description: 'Dos' }),
      ],
    });
    const w = equivalenceWarningsForQuotes([a, b]);
    assert.ok(w.some((x) => x.code === 'line_count_mismatch'));
  });

  it('filtra por material_key legacy', () => {
    const offers = buildLineOffersForQuote({
      quote: quote({ id: 'q1', title: 'A' }),
      lines: [
        line({
          id: 'l1',
          quoteId: 'q1',
          materialKey: 'KSK-01',
          description: 'Kiosko',
        }),
        line({
          id: 'l2',
          quoteId: 'q1',
          materialKey: 'acc',
          description: 'Otro',
        }),
      ],
    });
    const filtered = filterLineOffersByMaterialKey(offers, 'ksk-01');
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.lineId, 'l1');
  });
});

function roundVat(net: number, bps: number): number {
  return Math.round((net * bps) / 10000);
}
