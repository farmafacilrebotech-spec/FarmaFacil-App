/**
 * node --experimental-strip-types --test lib/pharmacies/pharmacy-qr-poster-compose.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  containRect,
  contrastOnWhite,
  layoutHeaderSlots,
  resolvePosterNameColor,
} from './pharmacy-qr-poster-compose.ts';

const BAND = { x: 10, y: 5, w: 190, h: 33 };

describe('contrastOnWhite / resolvePosterNameColor', () => {
  it('acepta turquesa oscuro con contraste suficiente', () => {
    const r = resolvePosterNameColor('#0D9488');
    assert.equal(r.usedFallback, false);
    assert.equal(r.color, '#0D9488');
    assert.ok(contrastOnWhite('#0D9488') >= 3);
  });

  it('fuerza fallback si el primario es demasiado claro', () => {
    const r = resolvePosterNameColor('#E8F8F7');
    assert.equal(r.usedFallback, true);
    assert.equal(r.color, '#0B0B0B');
  });

  it('fallback si hex inválido', () => {
    const r = resolvePosterNameColor('not-a-color');
    assert.equal(r.usedFallback, true);
  });
});

describe('layoutHeaderSlots', () => {
  it('sin logo: nombre usa todo el band con tipografía mayor', () => {
    const slots = layoutHeaderSlots(BAND, { hasLogo: false });
    assert.equal(slots.logoSlot, null);
    assert.ok(slots.nameSlot.h > BAND.h * 0.7);
    assert.equal(slots.nameMaxFontPt, 20);
  });

  it('logo circular: slot más alto que horizontal', () => {
    const circ = layoutHeaderSlots(BAND, {
      hasLogo: true,
      logoAspect: 1,
    });
    const horiz = layoutHeaderSlots(BAND, {
      hasLogo: true,
      logoAspect: 3.2,
    });
    assert.ok(circ.logoSlot);
    assert.ok(horiz.logoSlot);
    assert.ok(circ.logoSlot!.h > horiz.logoSlot!.h);
    assert.ok(circ.nameSlot.y > circ.logoSlot!.y + circ.logoSlot!.h);
  });

  it('logo y nombre no se solapan y quedan dentro del band', () => {
    const slots = layoutHeaderSlots(BAND, {
      hasLogo: true,
      logoAspect: 1.6,
    });
    assert.ok(slots.logoSlot);
    const logoBottom = slots.logoSlot!.y + slots.logoSlot!.h;
    assert.ok(slots.nameSlot.y >= logoBottom);
    assert.ok(
      slots.nameSlot.y + slots.nameSlot.h <= BAND.y + BAND.h + 0.01
    );
  });
});

describe('containRect', () => {
  it('no estira ni cubre', () => {
    const r = containRect(100, 100, { x: 0, y: 0, w: 200, h: 50 });
    assert.equal(r.w, 50);
    assert.equal(r.h, 50);
    assert.equal(r.x, 75);
  });
});
