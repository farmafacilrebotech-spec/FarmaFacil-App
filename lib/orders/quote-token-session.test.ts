import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  quoteSessionKeyFromFingerprint,
  quoteTokenCookieName,
  quoteTokenFingerprint,
  sessionKeyMatchesToken,
} from './quote-token-binding.ts';

describe('quote token session binding', () => {
  it('fingerprints distintos → sessionKeys distintas', () => {
    const a = quoteTokenFingerprint('token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const b = quoteTokenFingerprint('token-bbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    assert.notEqual(a, b);
    assert.notEqual(
      quoteSessionKeyFromFingerprint(a),
      quoteSessionKeyFromFingerprint(b)
    );
  });

  it('cookie name incluye sessionKey', () => {
    const fp = quoteTokenFingerprint('token-cccccccccccccccccccccccccccc');
    const key = quoteSessionKeyFromFingerprint(fp);
    assert.equal(quoteTokenCookieName(key), `ff_q_${key}`);
  });

  it('sessionKeyMatchesToken impide cruce A/B', () => {
    const tokenA = 'token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const tokenB = 'token-bbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const keyA = quoteSessionKeyFromFingerprint(quoteTokenFingerprint(tokenA));
    assert.equal(sessionKeyMatchesToken(keyA, tokenA), true);
    assert.equal(sessionKeyMatchesToken(keyA, tokenB), false);
  });

  it('rechaza sessionKey inválida', () => {
    assert.throws(() => quoteTokenCookieName('../x'), /invalid_quote_session_key/);
  });

  it('dos presupuestos → cookies ff_q_* distintas (no ff_q_tok global)', () => {
    const tokenA = 'token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const tokenB = 'token-bbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const keyA = quoteSessionKeyFromFingerprint(quoteTokenFingerprint(tokenA));
    const keyB = quoteSessionKeyFromFingerprint(quoteTokenFingerprint(tokenB));
    const nameA = quoteTokenCookieName(keyA);
    const nameB = quoteTokenCookieName(keyB);
    assert.notEqual(nameA, nameB);
    assert.match(nameA, /^ff_q_[a-f0-9]{32}$/);
    assert.match(nameB, /^ff_q_[a-f0-9]{32}$/);
    assert.equal(nameA.includes('ff_q_tok'), false);
    assert.equal(nameB.includes('ff_q_tok'), false);
    assert.equal(sessionKeyMatchesToken(keyA, tokenB), false);
    assert.equal(sessionKeyMatchesToken(keyB, tokenA), false);
  });
});
