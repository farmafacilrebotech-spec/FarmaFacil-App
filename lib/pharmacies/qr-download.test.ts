/**
 * npm run test:pharmacy-qr
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  QR_PNG_EXPORT_SIZE,
  buildOfficialQrPngDataUrl,
  buildOfficialQrSvgString,
  officialQrFilenames,
} from './qr-download.ts';

const SAMPLE_URL = 'https://app.farmafacil.solutions/e/abcdefghijklmnop';

describe('officialQrFilenames', () => {
  it('nombra PNG/SVG a partir del public_id', () => {
    assert.deepEqual(officialQrFilenames('ab12cd34ef56gh78'), {
      png: 'farmafacil-qr-ab12cd34ef56gh78.png',
      svg: 'farmafacil-qr-ab12cd34ef56gh78.svg',
    });
  });
});

describe('generación QR real', () => {
  it('PNG data URL de alta resolución', async () => {
    const dataUrl = await buildOfficialQrPngDataUrl(
      SAMPLE_URL,
      QR_PNG_EXPORT_SIZE
    );
    assert.match(dataUrl, /^data:image\/png;base64,/);
    assert.ok(dataUrl.length > 1000);
  });

  it('SVG vectorial contiene el payload', async () => {
    const svg = await buildOfficialQrSvgString(SAMPLE_URL);
    assert.match(svg, /<svg[\s>]/i);
    assert.ok(svg.length > 200);
  });
});
