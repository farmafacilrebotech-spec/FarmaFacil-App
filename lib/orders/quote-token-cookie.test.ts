import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { redactQuoteSecrets } from './quote-secrets.ts';

describe('redactQuoteSecrets', () => {
  it('oculta path /q/token y secretos largos', () => {
    const token = 'A'.repeat(43);
    const msg = `fail at /q/${token} body=${token}`;
    const out = redactQuoteSecrets(msg);
    assert.equal(out.includes(token), false);
    assert.match(out, /\/q\/\[redacted\]/);
  });
});
