/**
 * npm run test:auth-login-recovery
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  resolveClientPostLoginPath,
  sanitizeLoginNextParam,
} from './post-login-navigation.ts';

describe('sanitizeLoginNextParam', () => {
  it('allows pharmacy and auth continue paths', () => {
    assert.equal(
      sanitizeLoginNextParam('/f/af477147-a1cf-4520-b4cf-ba65596d6f4a/dashboard'),
      '/f/af477147-a1cf-4520-b4cf-ba65596d6f4a/dashboard'
    );
    assert.equal(sanitizeLoginNextParam('/auth/continue'), '/auth/continue');
    assert.equal(sanitizeLoginNextParam('/first-access'), '/first-access');
  });

  it('rejects open redirects and unrelated paths', () => {
    assert.equal(sanitizeLoginNextParam('https://evil.example'), null);
    assert.equal(sanitizeLoginNextParam('//evil.example'), null);
    assert.equal(sanitizeLoginNextParam('/dashboard'), null);
    assert.equal(sanitizeLoginNextParam(null), null);
  });
});

describe('resolveClientPostLoginPath', () => {
  it('defaults to /auth/continue to avoid cookie race with server actions', () => {
    assert.equal(resolveClientPostLoginPath(null), '/auth/continue');
  });

  it('keeps a sanitized next path', () => {
    assert.equal(
      resolveClientPostLoginPath('/auth/select-pharmacy'),
      '/auth/select-pharmacy'
    );
  });
});
