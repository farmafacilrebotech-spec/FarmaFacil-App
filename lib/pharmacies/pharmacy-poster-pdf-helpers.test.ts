import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { jsPDF } from 'jspdf';

import {
  addImageClippedToCircle,
  drawStagingWatermark,
} from './pharmacy-poster-pdf-helpers.ts';

// PNG 1×1 negro opaco.
const BLACK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function rawPdf(doc: jsPDF): string {
  return doc.output();
}

describe('addImageClippedToCircle', () => {
  it('emite clip (W n) dentro de q…Q antes de pintar la imagen', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
    addImageClippedToCircle(doc, BLACK_PNG, 'PNG', 20, 20, 28);
    const pdf = rawPdf(doc);
    const q = pdf.indexOf('\nq\n');
    const w = pdf.indexOf('\nW\n');
    const n = pdf.indexOf('\nn\n', w);
    const doOp = pdf.indexOf(' Do\n', n);
    const Q = pdf.indexOf('\nQ\n', doOp);
    assert.ok(q >= 0 && w > q, 'q antes de W');
    assert.ok(n > w, 'n (discardPath) tras W');
    assert.ok(doOp > n, 'imagen tras el clip');
    assert.ok(Q > doOp, 'restoreGraphicsState tras la imagen');
  });

  it('el clip no se filtra al resto de la página', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
    addImageClippedToCircle(doc, BLACK_PNG, 'PNG', 20, 20, 28);
    doc.rect(100, 100, 10, 10, 'F');
    const pdf = rawPdf(doc);
    assert.ok(pdf.lastIndexOf('\nQ\n') < pdf.lastIndexOf(' re\n'));
  });
});

describe('drawStagingWatermark', () => {
  it('dibuja el texto PRUEBA - STAGING con opacidad', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
    drawStagingWatermark(doc, { widthMm: 210, heightMm: 297 });
    const pdf = rawPdf(doc);
    assert.ok(pdf.includes('PRUEBA - STAGING'));
    assert.ok(/\/ca 0\.22|\/CA 0\.22/.test(pdf), 'opacidad 0.22');
  });
});
