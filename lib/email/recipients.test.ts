import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeRecipients } from './recipients.ts';

describe('normalizeRecipients', () => {
  it('acepta un Para', () => {
    const r = normalizeRecipients({ to: 'a@farmafacil.solutions' });
    assert.equal(r.ok, true);
  });

  it('rechaza varios Para', () => {
    const r = normalizeRecipients({
      to: 'a@x.com, b@x.com',
    });
    assert.equal(r.ok, false);
  });

  it('limita CC y total', () => {
    const r = normalizeRecipients({
      to: 'a@x.com',
      cc: 'b@x.com, c@x.com, d@x.com',
    });
    assert.equal(r.ok, false);
  });

  it('bloquea duplicados entre campos', () => {
    const r = normalizeRecipients({
      to: 'a@x.com',
      cc: 'a@x.com',
    });
    assert.equal(r.ok, false);
  });
});
