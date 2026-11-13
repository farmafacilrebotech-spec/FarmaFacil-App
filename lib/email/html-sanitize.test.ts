import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  extractComposerEditableHtml,
  sanitizeEmailHtml,
  wrapComposerHtmlForSend,
} from './html-sanitize.ts';

describe('html-sanitize / composer', () => {
  it('extrae body de documento completo', () => {
    const raw = `<!DOCTYPE html><html><body><p>Hola</p></body></html>`;
    const editable = extractComposerEditableHtml(raw);
    assert.ok(editable.includes('Hola'));
    assert.equal(editable.includes('<!DOCTYPE'), false);
  });

  it('envuelve fragmento para envío', () => {
    const wrapped = wrapComposerHtmlForSend('<p>Mensaje</p>');
    assert.ok(wrapped.includes('<!DOCTYPE'));
    assert.ok(wrapped.includes('Mensaje'));
  });

  it('bloquea script', () => {
    const editable = extractComposerEditableHtml(
      '<body><p>OK</p><script>alert(1)</script></body>'
    );
    assert.equal(editable.toLowerCase().includes('<script'), false);
    assert.equal(sanitizeEmailHtml('<p onclick="x">x</p>').includes('onclick'), false);
  });
});
