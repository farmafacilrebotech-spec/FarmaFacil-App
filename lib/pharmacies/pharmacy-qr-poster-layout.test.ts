/**
 * node --experimental-strip-types --test lib/pharmacies/pharmacy-qr-poster-layout.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { containRect } from './pharmacy-qr-poster-compose.ts';
import {
  insetRectMm,
  isPharmacyQrPosterDownloadEnabled,
  isPharmacyQrPosterTemplateReady,
  PHARMACY_QR_POSTER_LAYOUT,
  qrInnerRectMm,
  rectNormToMm,
  rectPxToNorm,
} from './pharmacy-qr-poster-layout.ts';

describe('PHARMACY_QR_POSTER_LAYOUT', () => {
  it('tiene plantilla Canva y zonas logo/nombre independientes; descarga on', () => {
    assert.equal(
      PHARMACY_QR_POSTER_LAYOUT.backgroundSrc,
      '/images/posters/pharmacy-qr-a4.png'
    );
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.logo.configured, true);
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.name.configured, true);
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.qr.configured, true);
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.pdfDownloadEnabled, true);
    assert.equal(isPharmacyQrPosterTemplateReady(), true);
    // Descarga definitiva activa tras aprobación visual.
    const prev = process.env.NEXT_PUBLIC_FF_POSTER_PDF_LOCAL;
    delete process.env.NEXT_PUBLIC_FF_POSTER_PDF_LOCAL;
    assert.equal(isPharmacyQrPosterDownloadEnabled(), true);
    process.env.NEXT_PUBLIC_FF_POSTER_PDF_LOCAL = '1';
    assert.equal(isPharmacyQrPosterDownloadEnabled(), true);
    if (prev === undefined) delete process.env.NEXT_PUBLIC_FF_POSTER_PDF_LOCAL;
    else process.env.NEXT_PUBLIC_FF_POSTER_PDF_LOCAL = prev;
  });

  it('A4 210×297 mm y template 4419×6250', () => {
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.page.widthMm, 210);
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.page.heightMm, 297);
    assert.deepEqual(PHARMACY_QR_POSTER_LAYOUT.templatePx, {
      width: 4419,
      height: 6250,
    });
  });

  it('logo y nombre no se solapan y quedan entre líneas turquesa HD', () => {
    const logo = PHARMACY_QR_POSTER_LAYOUT.logo.rect;
    const name = PHARMACY_QR_POSTER_LAYOUT.name.rect;
    const logoRight = logo.x + logo.w;
    const logoBottom = (logo.y + logo.h) * 6250;
    const nameBottom = (name.y + name.h) * 6250;
    const logoTop = logo.y * 6250;
    const nameTop = name.y * 6250;

    assert.ok(logoRight <= name.x + 1e-9, 'logo no invade zona nombre');
    // Entre teal ≈122 y 861
    assert.ok(logoTop >= 150 && logoTop <= 200);
    assert.ok(nameTop >= 150 && nameTop <= 200);
    assert.ok(logoBottom <= 820);
    assert.ok(nameBottom <= 830);
  });

  it('coordenadas HD coinciden con la anotación escalada', () => {
    const logo = PHARMACY_QR_POSTER_LAYOUT.logo.rect;
    const name = PHARMACY_QR_POSTER_LAYOUT.name.rect;
    assert.ok(Math.abs(logo.x * 4419 - 275) < 1);
    assert.ok(Math.abs(logo.y * 6250 - 177) < 1);
    assert.ok(Math.abs(logo.w * 4419 - 604) < 1);
    assert.ok(Math.abs(logo.h * 6250 - 610) < 1);
    assert.ok(Math.abs(name.x * 4419 - 983) < 1);
    assert.ok(Math.abs(name.y * 6250 - 177) < 1);
    assert.ok(Math.abs(name.w * 4419 - 3180) < 1);
    assert.ok(Math.abs(name.h * 6250 - 623) < 1);
  });
});

describe('insetRectMm / rectNormToMm', () => {
  it('aplica margen interior', () => {
    const inner = insetRectMm({ x: 0, y: 0, w: 100, h: 50 }, 0.1);
    assert.equal(inner.x, 5);
    assert.equal(inner.y, 5);
    assert.equal(inner.w, 90);
    assert.equal(inner.h, 40);
  });

  it('convierte fracciones a mm A4', () => {
    const mm = rectNormToMm(
      { x: 0.1, y: 0.2, w: 0.5, h: 0.25 },
      { widthMm: 210, heightMm: 297 }
    );
    assert.equal(mm.x, 21);
    assert.ok(Math.abs(mm.y - 59.4) < 1e-9);
    assert.equal(mm.w, 105);
  });

  it('convierte px de plantilla a fracción', () => {
    const n = rectPxToNorm(
      { x: 248, y: 350, w: 496, h: 200 },
      { width: 2480, height: 3508 }
    );
    assert.ok(Math.abs(n.x - 0.1) < 1e-9);
  });
});

describe('containRect', () => {
  it('centra horizontal sin stretch', () => {
    const r = containRect(200, 100, { x: 0, y: 0, w: 100, h: 100 });
    assert.equal(r.w, 100);
    assert.equal(r.h, 50);
    assert.equal(r.y, 25);
  });
});

describe('qrInnerRectMm', () => {
  it('aplica quiet zone y centra cuadrado', () => {
    const inner = qrInnerRectMm({ x: 0, y: 0, w: 100, h: 80 }, 0.1);
    assert.equal(inner.w, inner.h);
    assert.ok(inner.w < 80);
  });
});
