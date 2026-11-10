/**
 * node --experimental-strip-types --test lib/suppliers/purchase-math.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  allocateShippingNetProportional,
  computePurchaseMoney,
  DEFAULT_PO_UNIT_PRICE_NOTE,
  ensureDefaultPoNote,
  roundCents,
  splitGrossVat,
  unitCostExVatWithShipping,
  validatePurchaseDraft,
  withDefaultPoNoteOnCreate,
} from './purchase-math.ts';

describe('roundCents / splitGrossVat', () => {
  it('redondea half-up', () => {
    assert.equal(roundCents(1.4), 1);
    assert.equal(roundCents(1.5), 2);
    assert.equal(roundCents(-1.5), -2);
  });

  it('separa IVA incluido del transporte', () => {
    const r = splitGrossVat(12100, 2100, true);
    assert.equal(r.netCents, 10000);
    assert.equal(r.vatCents, 2100);
  });

  it('si no incluye IVA, la base es el importe y la cuota se calcula', () => {
    const r = splitGrossVat(10000, 2100, false);
    assert.equal(r.netCents, 10000);
    assert.equal(r.vatCents, 2100);
  });
});

describe('allocateShippingNetProportional', () => {
  it('reparte sin asignar el total a cada línea', () => {
    const shares = allocateShippingNetProportional(100, [75, 25]);
    assert.deepEqual(shares, [75, 25]);
    assert.equal(shares.reduce((a, b) => a + b, 0), 100);
  });
});

describe('computePurchaseMoney', () => {
  it('Total = base + IVA productos + transporte neto + IVA transporte', () => {
    const r = computePurchaseMoney({
      lines: [{ quantity: 2, unitPriceCents: 1000, vatBps: 2100 }],
      shippingCents: 500,
      shippingIncludesVat: false,
    });
    assert.equal(r.subtotalCents, 2000);
    assert.equal(r.productVatCents, 420);
    assert.equal(r.shippingNetCents, 500);
    assert.equal(r.shippingVatCents, 105);
    assert.equal(r.taxCents, 420 + 105);
    assert.equal(
      r.totalCents,
      r.subtotalCents + r.productVatCents + r.shippingNetCents + r.shippingVatCents
    );
    assert.equal(r.totalCents, r.subtotalCents + r.taxCents + r.shippingCents);
    assert.equal(r.lines[0]!.lineTotalCents, 2000 + 420);
    assert.equal(r.lines[0]!.unitCostExVatWithShippingCents, 1250);
  });

  it('no duplica IVA del transporte si ya viene incluido', () => {
    const r = computePurchaseMoney({
      lines: [{ quantity: 1, unitPriceCents: 10000, vatBps: 2100 }],
      shippingCents: 1210,
      shippingIncludesVat: true,
    });
    assert.equal(r.subtotalCents, 10000);
    assert.equal(r.productVatCents, 2100);
    assert.equal(r.shippingNetCents, 1000);
    assert.equal(r.shippingVatCents, 210);
    assert.equal(r.taxCents, 2100); // solo productos
    assert.equal(r.totalCents, 10000 + 2100 + 1000 + 210);
    assert.equal(r.totalCents, r.subtotalCents + r.taxCents + r.shippingCents);
  });

  it('reparte transporte en varias líneas', () => {
    const r = computePurchaseMoney({
      lines: [
        { quantity: 1, unitPriceCents: 7500, vatBps: 2100 },
        { quantity: 1, unitPriceCents: 2500, vatBps: 2100 },
      ],
      shippingCents: 1000,
      shippingIncludesVat: false,
    });
    assert.equal(r.lines[0]!.shippingNetShareCents, 750);
    assert.equal(r.lines[1]!.shippingNetShareCents, 250);
    assert.equal(r.lines[0]!.unitCostExVatWithShippingCents, 8250);
    assert.equal(r.lines[1]!.unitCostExVatWithShippingCents, 2750);
  });

  it('exige cantidad > 0', () => {
    assert.throws(() =>
      computePurchaseMoney({
        lines: [{ quantity: 0, unitPriceCents: 100 }],
        shippingCents: 0,
        shippingIncludesVat: false,
      })
    );
  });
});

describe('validatePurchaseDraft / notas', () => {
  it('señala pendientes sin bloquear cálculo parcial', () => {
    const v = validatePurchaseDraft({
      supplierId: '',
      title: '',
      orderedAt: '',
      lines: [],
      shippingCents: 0,
      shippingIncludesVat: false,
      requireShippingInformed: true,
      shippingInformed: false,
    });
    assert.ok(v.issues.some((i) => i.field === 'supplierId'));
    assert.ok(v.issues.some((i) => i.field === 'orderedAt'));
    assert.ok(v.issues.some((i) => i.field === 'lines'));
    assert.ok(v.issues.some((i) => i.field === 'shipping'));
    assert.equal(v.money, null);
  });

  it('calcula cuando las líneas están completas', () => {
    const v = validatePurchaseDraft({
      supplierId: 's1',
      title: 'Pedido',
      orderedAt: '2026-11-10',
      lines: [
        {
          description: 'Item',
          quantity: 2,
          unitPriceCents: 1000,
          vatBps: 0,
        },
      ],
      shippingCents: 0,
      shippingIncludesVat: false,
      requireShippingInformed: true,
      shippingInformed: true,
    });
    assert.equal(v.issues.length, 0);
    assert.ok(v.money);
    assert.equal(v.money!.subtotalCents, 2000);
    assert.equal(v.money!.productVatCents, 0);
  });

  it('notas por defecto', () => {
    assert.equal(withDefaultPoNoteOnCreate(null), DEFAULT_PO_UNIT_PRICE_NOTE);
    assert.equal(ensureDefaultPoNote('X'), 'X');
  });

  it('unitCost agregado', () => {
    assert.equal(
      unitCostExVatWithShipping({
        subtotalCents: 2000,
        shippingCents: 1210,
        shippingIncludesVat: true,
        quantity: 2,
      }),
      1500
    );
  });
});
