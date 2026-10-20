import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  normalizeUserMessage,
  sanitizeHistoryForModel,
} from './history.ts';
import { ASSISTANT_MAX_USER_CHARS } from './types.ts';

describe('normalizeUserMessage', () => {
  it('rechaza vacío y demasiado largo', () => {
    assert.equal(normalizeUserMessage('   ').ok, false);
    assert.equal(
      normalizeUserMessage('x'.repeat(ASSISTANT_MAX_USER_CHARS + 1)).ok,
      false
    );
  });

  it('normaliza espacios', () => {
    const r = normalizeUserMessage('  hola   mundo  ');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.text, 'hola mundo');
  });
});

describe('sanitizeHistoryForModel', () => {
  it('omite roles inválidos y recorta', () => {
    const out = sanitizeHistoryForModel(
      [
        { role: 'system', content: 'no' },
        { role: 'user', content: 'uno' },
        { role: 'assistant', content: 'dos' },
        { role: 'user', content: 'tres' },
      ],
      2
    );
    assert.deepEqual(out, [
      { role: 'assistant', content: 'dos' },
      { role: 'user', content: 'tres' },
    ]);
  });
});
