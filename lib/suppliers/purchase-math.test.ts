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
  withDefaultPoNoteOnCreate,
} from './purchase-math.ts';

describe('roundCents / splitGrossVat', () => {
  it('redondea half-up', () => {
    assert.equal(roundCents(1.4), 1);
    assert.equal(roundCents(1.5), 2);
    assert.equal(roundCents(-1.5), -2);
  });

  it('separa IVA incluido del transporte', () => {
    // 121 € con 21% → base 100 €
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

  it('asigna residual a la línea de mayor neto', () => {
    // 10 céntimos sobre 3+3 → 3+3 con residual 4 en la última empatada
    const shares = allocateShippingNetProportional(10, [333, 333, 334]);
    assert.equal(shares.reduce((a, b) => a + b, 0), 10);
    assert.ok(shares.every((s) => s >= 0));
  });
});

describe('computePurchaseMoney', () => {
  it('Total = subtotal + impuestos + transporte (transporte sin IVA)', () => {
    const r = computePurchaseMoney({
      lines: [{ quantity: 2, unitPriceCents: 1000, vatBps: 2100 }],
      shippingCents: 500,
      shippingIncludesVat: false,
    });
    assert.equal(r.subtotalCents, 2000);
    assert.equal(r.taxCents, 420 + 105); // líneas 21% + transporte 21%
    assert.equal(r.shippingCents, 500);
    assert.equal(r.totalCents, r.subtotalCents + r.taxCents + r.shippingCents);
    assert.equal(r.lines[0]!.unitCostExVatWithShippingCents, 1250); // (2000+500)/2
  });

  it('no suma el IVA del transporte dos veces si ya viene incluido', () => {
    const r = computePurchaseMoney({
      lines: [{ quantity: 1, unitPriceCents: 10000, vatBps: 2100 }],
      shippingCents: 1210, // 10 € + 21%
      shippingIncludesVat: true,
    });
    assert.equal(r.subtotalCents, 10000);
    assert.equal(r.taxCents, 2100); // solo IVA de líneas
    assert.equal(r.shippingNetCents, 1000);
    assert.equal(r.shippingVatCents, 210);
    assert.equal(r.totalCents, 10000 + 2100 + 1210);
    assert.equal(r.lines[0]!.unitCostExVatWithShippingCents, 11000); // (10000+1000)/1
  });

  it('reparte transporte en varias líneas de forma proporcional', () => {
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

  it('respeta overrides de subtotal/impuestos del formulario', () => {
    const r = computePurchaseMoney({
      lines: [{ quantity: 10, unitPriceCents: 100, vatBps: 2100 }],
      shippingCents: 0,
      shippingIncludesVat: false,
      subtotalOverrideCents: 1500,
      taxOverrideCents: 315,
    });
    assert.equal(r.subtotalCents, 1500);
    assert.equal(r.taxCents, 315);
    assert.equal(r.totalCents, 1815);
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

describe('unitCostExVatWithShipping + notas', () => {
  it('calcula coste unitario agregado', () => {
    assert.equal(
      unitCostExVatWithShipping({
        subtotalCents: 2000,
        shippingCents: 1210,
        shippingIncludesVat: true,
        quantity: 2,
      }),
      1500 // (2000+1000)/2
    );
  });

  it('añade nota por defecto solo al crear / si está vacía', () => {
    assert.equal(withDefaultPoNoteOnCreate(null), DEFAULT_PO_UNIT_PRICE_NOTE);
    assert.equal(
      withDefaultPoNoteOnCreate('Condiciones X'),
      `Condiciones X\n${DEFAULT_PO_UNIT_PRICE_NOTE}`
    );
    assert.equal(
      ensureDefaultPoNote('Notas del usuario'),
      'Notas del usuario'
    );
  });
});
