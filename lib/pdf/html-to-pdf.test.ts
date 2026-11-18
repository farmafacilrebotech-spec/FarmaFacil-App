/**
 * PRE-05B · HTML → PDF (Chromium local).
 * node --experimental-strip-types --test lib/pdf/html-to-pdf.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { renderHtmlToPdf } from './html-to-pdf.ts';

describe('renderHtmlToPdf', () => {
  it('genera un PDF válido a partir de HTML autocontenido', async () => {
    const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Test PRE-05B</title>
<style>
  body { font-family: Georgia, serif; color: #0b0b0b; padding: 24px; }
  h1 { color: #1abbb3; }
</style></head>
<body>
  <h1>FarmaFácil · presupuesto corporativo</h1>
  <p>Plantilla HTML de prueba PRE-05B.</p>
</body></html>`;

    const result = await renderHtmlToPdf(html, { format: 'A4' });
    assert.equal(result.mimeType, 'application/pdf');
    assert.ok(result.bytes.byteLength > 500, 'PDF demasiado pequeño');
    const head = Buffer.from(result.bytes.slice(0, 5)).toString('utf8');
    assert.equal(head, '%PDF-');
  });
});
