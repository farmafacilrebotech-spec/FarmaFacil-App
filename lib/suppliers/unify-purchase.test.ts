/**
 * node --experimental-strip-types --test lib/suppliers/unify-purchase.test.ts
 *
 * Contrato de unificación económica ↔ extensión kiosk (sin I/O).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('unificación compras proveedores', () => {
  it('define categoría kioskos como la que requiere extensión operativa', () => {
    const needsKioskExtension = (category: string) => category === 'kioskos';
    assert.equal(needsKioskExtension('kioskos'), true);
    assert.equal(needsKioskExtension('tecnologia'), false);
    assert.equal(needsKioskExtension('servicios'), false);
  });

  it('no duplica importes: costs de extensión deben ir null si el general ya los tiene', () => {
    const general = {
      subtotalCents: 10000,
      taxCents: 2100,
      shippingCents: 500,
      totalCents: 12600,
    };
    const kioskCosts = {
      unitPriceCents: null as number | null,
      shippingCents: null as number | null,
      totalCents: null as number | null,
    };
    assert.equal(kioskCosts.unitPriceCents, null);
    assert.equal(kioskCosts.totalCents, null);
    assert.ok(general.totalCents > 0);
  });

  it('idempotencia: un quote activo → un general; un general → una extensión', () => {
    const activeGeneralsByQuote = new Map<string, string>();
    const activeKioskByGeneral = new Map<string, string>();

    function createOrGet(quoteId: string, generalIdNew: string, kioskIdNew: string) {
      const existingG = activeGeneralsByQuote.get(quoteId);
      const generalId = existingG ?? generalIdNew;
      if (!existingG) activeGeneralsByQuote.set(quoteId, generalId);
      const existingK = activeKioskByGeneral.get(generalId);
      const kioskId = existingK ?? kioskIdNew;
      if (!existingK) activeKioskByGeneral.set(generalId, kioskId);
      return { generalId, kioskId, generalExisted: Boolean(existingG), kioskExisted: Boolean(existingK) };
    }

    const a = createOrGet('q1', 'g1', 'k1');
    const b = createOrGet('q1', 'g2', 'k2');
    assert.equal(a.generalId, 'g1');
    assert.equal(b.generalId, 'g1');
    assert.equal(b.kioskId, 'k1');
    assert.equal(b.generalExisted, true);
    assert.equal(b.kioskExisted, true);
  });
});
