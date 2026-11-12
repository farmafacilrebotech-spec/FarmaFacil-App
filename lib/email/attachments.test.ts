import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  sniffAttachmentMime,
  validateAttachmentBatch,
  validateAttachmentBytes,
  validateAttachmentMeta,
} from './attachments.ts';

describe('attachments validation', () => {
  it('acepta PDF válido', () => {
    const r = validateAttachmentMeta({
      fileName: 'presupuesto.pdf',
      contentType: 'application/pdf',
      byteSize: 1024,
    });
    assert.equal(r.ok, true);
  });

  it('acepta Excel y Word por extensión', () => {
    assert.equal(
      validateAttachmentMeta({
        fileName: 'lista.xlsx',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        byteSize: 2048,
      }).ok,
      true
    );
    assert.equal(
      validateAttachmentMeta({
        fileName: 'contrato.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        byteSize: 2048,
      }).ok,
      true
    );
  });

  it('rechaza exe', () => {
    const r = validateAttachmentMeta({
      fileName: 'x.exe',
      contentType: 'application/octet-stream',
      byteSize: 10,
    });
    assert.equal(r.ok, false);
  });

  it('limita lote', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({
      fileName: `f${i}.pdf`,
      contentType: 'application/pdf',
      byteSize: 100,
    }));
    const r = validateAttachmentBatch(items);
    assert.equal(r.ok, false);
  });

  it('valida magic bytes PDF', () => {
    const pdf = new TextEncoder().encode('%PDF-1.4 fake');
    const ok = validateAttachmentBytes({
      fileName: 'a.pdf',
      contentType: 'application/pdf',
      bytes: pdf,
    });
    assert.equal(ok.ok, true);

    const bad = validateAttachmentBytes({
      fileName: 'a.pdf',
      contentType: 'application/pdf',
      bytes: new TextEncoder().encode('not-a-pdf'),
    });
    assert.equal(bad.ok, false);
  });

  it('sniff PNG/JPEG', () => {
    const png = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0,
    ]);
    assert.equal(sniffAttachmentMime(png, 'image/png').ok, true);
    const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
    assert.equal(sniffAttachmentMime(jpg, 'image/jpeg').ok, true);
  });
});
