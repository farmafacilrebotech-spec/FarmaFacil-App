/**
 * npm run test:auth-login-recovery
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildPasswordRecoveryRedirectTo,
  isValidRecoveryEmail,
  mapPasswordRecoveryAuthError,
  recoveryUrlHasAuthMaterial,
} from './password-recovery-shared.ts';

describe('buildPasswordRecoveryRedirectTo', () => {
  it('uses the tab origin so 127.0.0.1 stays 127.0.0.1', () => {
    assert.equal(
      buildPasswordRecoveryRedirectTo('http://127.0.0.1:3010'),
      'http://127.0.0.1:3010/auth/recovery'
    );
    assert.equal(
      buildPasswordRecoveryRedirectTo('http://127.0.0.1:3010/'),
      'http://127.0.0.1:3010/auth/recovery'
    );
  });

  it('does not rewrite to localhost', () => {
    const to = buildPasswordRecoveryRedirectTo('http://127.0.0.1:3010');
    assert.equal(to.includes('localhost'), false);
    assert.equal(to.includes('127.0.0.1'), true);
  });
});

describe('recoveryUrlHasAuthMaterial', () => {
  it('detects PKCE code and token_hash', () => {
    assert.equal(
      recoveryUrlHasAuthMaterial({ search: '?code=abc', hash: '' }),
      true
    );
    assert.equal(
      recoveryUrlHasAuthMaterial({
        search: '?token_hash=xyz&type=recovery',
        hash: '',
      }),
      true
    );
  });

  it('detects fragment recovery tokens', () => {
    assert.equal(
      recoveryUrlHasAuthMaterial({
        search: '',
        hash: '#access_token=aaa&refresh_token=bbb&type=recovery',
      }),
      true
    );
  });

  it('bare /auth/recovery has no material (request screen must not require token)', () => {
    assert.equal(
      recoveryUrlHasAuthMaterial({ search: '', hash: '' }),
      false
    );
  });
});

describe('mapPasswordRecoveryAuthError', () => {
  it('maps rate limit without inventing success', () => {
    const r = mapPasswordRecoveryAuthError('email rate limit exceeded');
    assert.equal(r.code, 'rate_limit');
    assert.match(r.error, /demasiadas solicitudes/i);
  });
});

describe('isValidRecoveryEmail', () => {
  it('validates basic email shape', () => {
    assert.equal(isValidRecoveryEmail('rebotech.solutions@gmail.com'), true);
    assert.equal(isValidRecoveryEmail('  bad  '), false);
  });
});
