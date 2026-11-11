/**
 * node --experimental-strip-types --test lib/pharmacies/pharmacy-qr-poster-layout.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  containRect,
  isPharmacyQrPosterDownloadEnabled,
  isPharmacyQrPosterTemplateReady,
  PHARMACY_QR_POSTER_LAYOUT,
  qrInnerRectMm,
  rectNormToMm,
  rectPxToNorm,
  type PharmacyQrPosterLayout,
} from './pharmacy-qr-poster-layout.ts';

describe('PHARMACY_QR_POSTER_LAYOUT', () => {
  it('espera PNG Canva y mantiene descarga desactivada', () => {
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.backgroundSrc, null);
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.logo.configured, false);
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.name.configured, false);
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.qr.configured, false);
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.pdfDownloadEnabled, false);
    assert.equal(isPharmacyQrPosterTemplateReady(), false);
    assert.equal(isPharmacyQrPosterDownloadEnabled(), false);
  });

  it('A4 210×297 mm', () => {
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.page.widthMm, 210);
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.page.heightMm, 297);
  });
});

describe('rectNormToMm / rectPxToNorm', () => {
  it('convierte fracciones a mm A4', () => {
    const mm = rectNormToMm(
      { x: 0.1, y: 0.2, w: 0.5, h: 0.25 },
      { widthMm: 210, heightMm: 297 }
    );
    assert.equal(mm.x, 21);
    assert.ok(Math.abs(mm.y - 59.4) < 1e-9);
    assert.equal(mm.w, 105);
    assert.ok(Math.abs(mm.h - 74.25) < 1e-9);
  });

  it('convierte px de plantilla a fracción', () => {
    const n = rectPxToNorm(
      { x: 248, y: 350, w: 496, h: 200 },
      { width: 2480, height: 3508 }
    );
    assert.ok(Math.abs(n.x - 0.1) < 1e-9);
    assert.ok(Math.abs(n.y - 350 / 3508) < 1e-9);
  });
});

describe('containRect', () => {
  it('centra horizontal sin stretch', () => {
    const r = containRect(200, 100, { x: 0, y: 0, w: 100, h: 100 });
    assert.equal(r.w, 100);
    assert.equal(r.h, 50);
    assert.equal(r.x, 0);
    assert.equal(r.y, 25);
  });

  it('centra vertical para logo vertical', () => {
    const r = containRect(50, 100, { x: 10, y: 10, w: 80, h: 80 });
    assert.equal(r.w, 40);
    assert.equal(r.h, 80);
    assert.equal(r.x, 30);
    assert.equal(r.y, 10);
  });
});

describe('qrInnerRectMm', () => {
  it('aplica quiet zone y centra cuadrado', () => {
    const inner = qrInnerRectMm({ x: 0, y: 0, w: 100, h: 80 }, 0.1);
    assert.ok(inner.w <= 80);
    assert.equal(inner.w, inner.h);
  });
});

describe('isPharmacyQrPosterDownloadEnabled', () => {
  it('exige plantilla ready y flag de aprobación', () => {
    const base: PharmacyQrPosterLayout = {
      backgroundSrc: '/images/posters/pharmacy-qr-a4.png',
      templatePx: { width: 2480, height: 3508 },
      page: { widthMm: 210, heightMm: 297 },
      logo: {
        configured: true,
        rect: { x: 0.3, y: 0.08, w: 0.4, h: 0.12 },
      },
      name: {
        configured: true,
        rect: { x: 0.1, y: 0.22, w: 0.8, h: 0.08 },
        rectWithoutLogo: { x: 0.1, y: 0.08, w: 0.8, h: 0.2 },
        maxFontSizePt: 22,
        minFontSizePt: 10,
        maxLines: 2,
        color: '#0B0B0B',
        align: 'center',
        fontStyle: 'bold',
      },
      qr: {
        configured: true,
        rect: { x: 0.25, y: 0.45, w: 0.5, h: 0.35 },
        quietZoneRatio: 0.06,
      },
      pdfDownloadEnabled: false,
    };
    assert.equal(isPharmacyQrPosterTemplateReady(base), true);
    assert.equal(isPharmacyQrPosterDownloadEnabled(base), false);
    assert.equal(
      isPharmacyQrPosterDownloadEnabled({ ...base, pdfDownloadEnabled: true }),
      true
    );
  });
});
