/**
 * node --experimental-strip-types --test lib/pharmacies/pharmacy-qr-poster-fit.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  fitPharmacyNameInZone,
  ptToMm,
  type NameZoneFitConfig,
} from './pharmacy-qr-poster-fit.ts';

function mockDoc(widths: Record<string, number> = {}) {
  let fontSize = 12;
  return {
    setFont() {},
    setFontSize(size: number) {
      fontSize = size;
    },
    splitTextToSize(text: string, maxlen: number) {
      // Simula palabras; cada carácter ~0.5 * fontSize pt en “unidades”
      const words = text.split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let cur = '';
      for (const w of words) {
        const candidate = cur ? `${cur} ${w}` : w;
        const approx = candidate.length * fontSize * 0.35;
        const forced = widths[candidate];
        const width = forced ?? approx;
        if (width > maxlen && cur) {
          lines.push(cur);
          cur = w;
        } else {
          cur = candidate;
        }
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [text];
    },
  };
}

const zone: NameZoneFitConfig = {
  maxFontSizePt: 20,
  minFontSizePt: 10,
  maxLines: 2,
  fontStyle: 'bold',
};

describe('fitPharmacyNameInZone', () => {
  it('cabe nombre corto en una línea', () => {
    const fit = fitPharmacyNameInZone(
      mockDoc(),
      'Farmacia Centro',
      { x: 20, y: 60, w: 170, h: 20 },
      zone
    );
    assert.equal(fit.ok, true);
    assert.equal(fit.warning, null);
    assert.ok(fit.lines.length >= 1 && fit.lines.length <= 2);
    assert.ok(fit.fontSizePt >= zone.minFontSizePt);
  });

  it('reduce tamaño ante nombre largo', () => {
    const long =
      'Farmacia Fase7 Staging Clientes QR Con Nombre Muy Largo Para Probar';
    const fit = fitPharmacyNameInZone(
      mockDoc(),
      long,
      { x: 20, y: 60, w: 120, h: 18 },
      zone
    );
    assert.ok(fit.fontSizePt <= zone.maxFontSizePt);
    assert.ok(fit.lines.length <= 2);
  });

  it('avisa si ni el mínimo cabe', () => {
    const extreme =
      'Farmacia Supercalifragilisticaespialidosa Del Barrio Norte Este Oeste Con Anexo Clinico Especializado';
    const fit = fitPharmacyNameInZone(
      mockDoc(),
      extreme,
      { x: 20, y: 60, w: 40, h: 8 },
      { ...zone, minFontSizePt: 12, maxFontSizePt: 12 }
    );
    assert.equal(fit.ok, false);
    assert.match(String(fit.warning), /largo|legible/i);
  });
});

describe('ptToMm', () => {
  it('convierte 72pt a 25.4mm', () => {
    assert.ok(Math.abs(ptToMm(72) - 25.4) < 1e-9);
  });
});
