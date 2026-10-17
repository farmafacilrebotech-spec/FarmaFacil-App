import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyAuthCallbackError,
  inviteAuthAlreadyRegistered,
} from './invite-auth-logic.ts';
import { buildAuthCallbackUrl } from '../email/auth-callback-url.ts';

describe('inviteAuthAlreadyRegistered', () => {
  it('detects common Auth already-registered messages', () => {
    assert.equal(
      inviteAuthAlreadyRegistered(
        'A user with this email address has already been registered'
      ),
      true
    );
    assert.equal(inviteAuthAlreadyRegistered('email exists'), true);
    assert.equal(inviteAuthAlreadyRegistered('network timeout'), false);
  });
});

describe('classifyAuthCallbackError', () => {
  it('maps expired OTP', () => {
    assert.equal(
      classifyAuthCallbackError('Token has expired or is invalid').code,
      'otp_expired'
    );
    assert.equal(classifyAuthCallbackError('otp_expired').code, 'otp_expired');
  });

  it('maps used OTP', () => {
    assert.equal(
      classifyAuthCallbackError('Token has already been used').code,
      'otp_used'
    );
  });

  it('falls back to auth_callback', () => {
    assert.equal(
      classifyAuthCallbackError('unexpected failure').code,
      'auth_callback'
    );
  });
});

describe('buildAuthCallbackUrl', () => {
  it('builds token_hash SSR URL on the canonical host', () => {
    const url = buildAuthCallbackUrl({
      appBaseUrl: 'https://app.farmafacil.solutions',
      hashedToken: 'abc123',
      otpType: 'invite',
      nextPath: '/first-access',
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin, 'https://app.farmafacil.solutions');
    assert.equal(parsed.pathname, '/auth/callback');
    assert.equal(parsed.searchParams.get('token_hash'), 'abc123');
    assert.equal(parsed.searchParams.get('type'), 'invite');
    assert.equal(parsed.searchParams.get('next'), '/first-access');
  });

  it('keeps invitations next path with email hint', () => {
    const next = '/auth/invitations?for=user%40example.com';
    const url = buildAuthCallbackUrl({
      appBaseUrl: 'https://app.farmafacil.solutions',
      hashedToken: 'tok',
      otpType: 'magiclink',
      nextPath: next,
    });
    assert.equal(new URL(url).searchParams.get('next'), next);
  });
});
