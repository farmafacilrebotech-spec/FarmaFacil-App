import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  validateAttachmentBatch,
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
});
