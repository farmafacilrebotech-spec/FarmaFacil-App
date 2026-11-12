import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertCorporateSendPolicy,
  defaultPurposeForTemplate,
} from './corporate-send-policy.ts';

const base = {
  recipientEmail: 'test@example.com',
  subject: 'Hola',
  htmlBody: '<p>x</p>',
  textBody: 'x',
  explicitConfirm: true,
  commercialAuthAck: false,
  oppositionChecked: false,
  recipientSuppressed: false,
  legalBasis: null as null,
};

describe('assertCorporateSendPolicy', () => {
  it('permite operativo con confirmación', () => {
    const r = assertCorporateSendPolicy({
      ...base,
      purpose: 'operational',
    });
    assert.equal(r.ok, true);
  });

  it('bloquea comercial sin base legal', () => {
    const r = assertCorporateSendPolicy({
      ...base,
      purpose: 'commercial',
      commercialAuthAck: true,
      oppositionChecked: true,
      legalBasis: null,
    });
    assert.equal(r.ok, false);
  });

  it('bloquea destinatario en oposición', () => {
    const r = assertCorporateSendPolicy({
      ...base,
      purpose: 'commercial',
      commercialAuthAck: true,
      oppositionChecked: true,
      legalBasis: 'consent',
      recipientSuppressed: true,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'recipient_suppressed');
  });

  it('defaultPurposeForTemplate', () => {
    assert.equal(defaultPurposeForTemplate('demo'), 'commercial');
    assert.equal(defaultPurposeForTemplate('blank'), 'operational');
  });
});
