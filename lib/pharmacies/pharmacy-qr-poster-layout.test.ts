/**
 * node --experimental-strip-types --test lib/pharmacies/pharmacy-qr-poster-layout.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isPharmacyQrPosterTemplateReady,
  PHARMACY_QR_POSTER_LAYOUT,
  PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE,
  type PharmacyQrPosterLayout,
} from './pharmacy-qr-poster-layout.ts';

describe('PHARMACY_QR_POSTER_LAYOUT', () => {
  it('está pendiente de plantilla Canva (sin inventar asset)', () => {
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.backgroundSrc, null);
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.name.configured, false);
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.qr.configured, false);
    assert.equal(isPharmacyQrPosterTemplateReady(), false);
    assert.match(PHARMACY_QR_POSTER_TEMPLATE_PENDING_MESSAGE, /Canva/);
  });

  it('A4 vertical 210×297 mm', () => {
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.page.widthMm, 210);
    assert.equal(PHARMACY_QR_POSTER_LAYOUT.page.heightMm, 297);
  });

  it('ready solo con fondo + ambas zonas configuradas y con tamaño', () => {
    const ready: PharmacyQrPosterLayout = {
      backgroundSrc: '/images/posters/pharmacy-qr-a4.png',
      page: { widthMm: 210, heightMm: 297 },
      name: {
        configured: true,
        rect: { x: 20, y: 70, w: 170, h: 18 },
        fontSizePt: 16,
        color: '#0B0B0B',
        align: 'center',
        fontStyle: 'bold',
      },
      qr: {
        configured: true,
        rect: { x: 55, y: 140, w: 100, h: 100 },
      },
    };
    assert.equal(isPharmacyQrPosterTemplateReady(ready), true);

    const noQr: PharmacyQrPosterLayout = {
      ...ready,
      qr: { ...ready.qr, configured: false },
    };
    assert.equal(isPharmacyQrPosterTemplateReady(noQr), false);
  });
});
