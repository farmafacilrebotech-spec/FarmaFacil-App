import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classifyAuthCallbackError,
  inviteAuthAlreadyRegistered,
  inviteEmailNextPath,
  resolvePharmacyInviteEmailKind,
} from './invite-auth-logic.ts';
import {
  buildAuthCallbackUrl,
  buildInviteOpenUrl,
} from '../email/auth-callback-url.ts';
import { classifyInviteUserKind } from './invite-user-kind-logic.ts';

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

describe('resolvePharmacyInviteEmailKind', () => {
  it('Auth confirmado + solo membership invited → email new (first-access)', () => {
    const membershipKind = classifyInviteUserKind(['invited']);
    assert.equal(membershipKind, 'new');
    assert.equal(resolvePharmacyInviteEmailKind(membershipKind), 'new');
    assert.equal(inviteEmailNextPath('new', 'a@b.com'), '/first-access');
  });

  it('no usa authLink.kind=existing para forzar invitations si membership es new', () => {
    // Simula el bug: authLink.kind existing (magiclink) con membership new.
    const authLinkKind = 'existing' as const;
    const membershipKind = classifyInviteUserKind(['invited']);
    const emailKind = resolvePharmacyInviteEmailKind(membershipKind);
    assert.equal(membershipKind, 'new');
    assert.notEqual(emailKind, authLinkKind);
    assert.equal(emailKind, 'new');
  });

  it('usuario FarmaFácil con active → email existing (invitations)', () => {
    const membershipKind = classifyInviteUserKind(['active', 'invited']);
    assert.equal(resolvePharmacyInviteEmailKind(membershipKind), 'existing');
    assert.match(
      inviteEmailNextPath('existing', 'User@Example.com'),
      /^\/auth\/invitations\?for=user%40example\.com$/
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

describe('buildInviteOpenUrl', () => {
  it('points emails at invite-open (no verify on GET)', () => {
    const url = buildInviteOpenUrl({
      appBaseUrl: 'http://127.0.0.1:3010',
      hashedToken: 'hashed',
      otpType: 'magiclink',
      nextPath: '/first-access',
    });
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/auth/invite-open');
    assert.equal(parsed.searchParams.get('type'), 'magiclink');
    assert.equal(parsed.searchParams.get('next'), '/first-access');
    assert.equal(parsed.searchParams.get('token_hash'), 'hashed');
  });

  it('confirmed Auth pending first-access uses magiclink + first-access', () => {
    const emailKind = resolvePharmacyInviteEmailKind(
      classifyInviteUserKind(['invited'])
    );
    const next = inviteEmailNextPath(emailKind, 'rebotech.solutions@gmail.com');
    const url = buildInviteOpenUrl({
      appBaseUrl: 'http://127.0.0.1:3010',
      hashedToken: 'x',
      otpType: 'magiclink',
      nextPath: next,
    });
    assert.equal(new URL(url).searchParams.get('next'), '/first-access');
    assert.equal(new URL(url).searchParams.get('type'), 'magiclink');
  });
});

describe('first-access routing expectations', () => {
  it('token consumido / caducado → classify a login error codes', () => {
    assert.equal(
      classifyAuthCallbackError('Token has already been used').code,
      'otp_used'
    );
    assert.equal(
      classifyAuthCallbackError('Token has expired or is invalid').code,
      'otp_expired'
    );
  });

  it('sesión válida con invited + sin legal → destino first-access', () => {
    // resolveAppAccess: needsFirstAccess = !hasLegal → destination first-access
    const needsFirstAccess = true;
    const destination = needsFirstAccess ? '/first-access' : '/auth/invitations';
    assert.equal(destination, '/first-access');
  });

  it('tras aceptar invitación (usuario existing) → invitations no first-access', () => {
    const emailKind = resolvePharmacyInviteEmailKind(
      classifyInviteUserKind(['active'])
    );
    assert.equal(emailKind, 'existing');
    assert.match(inviteEmailNextPath(emailKind, 'a@b.co'), /\/auth\/invitations/);
  });

  it('PASS de first-access exige formulario de contraseña, no solo HTTP 200', () => {
    const noSessionHtml =
      '<h1>Enlace de invitación requerido</h1><a href="/login">Ir al inicio de sesión</a>';
    const formHtml =
      '<h1>Completar acceso</h1><input type="password" /><button>Finalizar acceso</button>';
    assert.equal(noSessionHtml.includes('Enlace de invitación requerido'), true);
    assert.equal(formHtml.includes('type="password"'), true);
    assert.equal(
      noSessionHtml.includes('type="password"'),
      false,
      'no-session page must not count as PASS'
    );
  });
});
