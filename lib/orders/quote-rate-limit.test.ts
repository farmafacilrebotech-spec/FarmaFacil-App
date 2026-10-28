import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  QUOTE_RATE_MAX_ATTEMPTS,
  isQuoteRateRpcMissingMessage,
  quoteRateAllowMemory,
  quoteRateAllowShared,
  quoteRateResetForTests,
} from './quote-rate-limit.ts';

describe('quoteRateAllowMemory', () => {
  it('bloquea tras el máximo de intentos', () => {
    quoteRateResetForTests();
    const key = 'a'.repeat(64);
    let allowed = 0;
    let blocked = 0;
    for (let i = 0; i < QUOTE_RATE_MAX_ATTEMPTS + 10; i++) {
      if (quoteRateAllowMemory(key)) allowed++;
      else blocked++;
    }
    assert.equal(allowed, QUOTE_RATE_MAX_ATTEMPTS);
    assert.equal(blocked, 10);
  });
});

describe('quoteRateAllowShared fail-closed', () => {
  it('usa postgres cuando responde', async () => {
    const r = await quoteRateAllowShared('b'.repeat(64), async () => ({
      allowed: false,
    }));
    assert.equal(r.source, 'postgres');
    assert.equal(r.allowed, false);
  });

  it('cae a memoria solo si RPC missing', async () => {
    quoteRateResetForTests();
    const key = 'c'.repeat(64);
    const r = await quoteRateAllowShared(key, async () => ({ missing: true }));
    assert.equal(r.source, 'memory');
    assert.equal(r.allowed, true);
  });

  it('DENIEGA si Postgres falla (no missing)', async () => {
    const r = await quoteRateAllowShared('d'.repeat(64), async () => ({
      error: true,
    }));
    assert.equal(r.source, 'denied');
    assert.equal(r.allowed, false);
  });

  it('DENIEGA si el callback lanza', async () => {
    const r = await quoteRateAllowShared('e'.repeat(64), async () => {
      throw new Error('network');
    });
    assert.equal(r.source, 'denied');
    assert.equal(r.allowed, false);
  });

  it('detecta mensajes missing', () => {
    assert.equal(
      isQuoteRateRpcMissingMessage('function ff_public_qr_quote_rate_allow_v1 does not exist'),
      true
    );
    assert.equal(isQuoteRateRpcMissingMessage('connection refused'), false);
  });
});
