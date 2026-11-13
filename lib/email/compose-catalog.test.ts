import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EMAIL_TEMPLATE_SLUGS,
  isEmailTemplateSlug,
} from './email-template-slugs.ts';
import {
  CORPORATE_EMAIL_SEND_ENABLED,
  assertCorporateSendBlocked,
  validateEmailDraftInput,
} from './draft-validation.ts';

describe('email-template-slugs', () => {
  it('exposes template slugs including blank and custom', () => {
    assert.deepEqual([...EMAIL_TEMPLATE_SLUGS], [
      'blank',
      'lanzadera',
      'imprentas',
      'demo',
      'piloto',
      'custom',
    ]);
  });

  it('type-guards template slug', () => {
    assert.equal(isEmailTemplateSlug('demo'), true);
    assert.equal(isEmailTemplateSlug('campaign'), false);
  });
});

describe('draft-validation', () => {
  it('accepts draft without recipient', () => {
    const r = validateEmailDraftInput({
      templateSlug: 'blank',
      subject: 'Hola',
      htmlBody: '<p>x</p>',
      textBody: 'x',
      recipientEmail: '',
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.draft.recipientEmail, '');
  });

  it('rejects invalid recipient and unknown template', () => {
    const badEmail = validateEmailDraftInput({
      templateSlug: 'blank',
      subject: 'Hola',
      htmlBody: '<p>x</p>',
      textBody: 'x',
      recipientEmail: 'not-an-email',
    });
    assert.equal(badEmail.ok, false);

    const badTpl = validateEmailDraftInput({
      templateSlug: 'mass',
      subject: 'Hola',
      htmlBody: '<p>x</p>',
      textBody: 'x',
      recipientEmail: 'a@b.com',
    });
    assert.equal(badTpl.ok, false);
  });

  it('keeps corporate send disabled', () => {
    assert.equal(CORPORATE_EMAIL_SEND_ENABLED, false);
    const blocked = assertCorporateSendBlocked();
    assert.equal(blocked.ok, false);
    assert.match(blocked.error, /desactivado|bloqueado|FF_CORPORATE_EMAIL_SEND_ENABLED/i);
  });
});
