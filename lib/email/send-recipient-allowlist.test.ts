import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertCorporateEmailRecipientsAllowed,
  parseCorporateEmailTestRecipients,
} from './send-recipient-allowlist.ts';

describe('parseCorporateEmailTestRecipients', () => {
  it('null si no hay variable', () => {
    assert.equal(parseCorporateEmailTestRecipients({}), null);
  });

  it('parsea CSV normalizado', () => {
    const list = parseCorporateEmailTestRecipients({
      FF_CORPORATE_EMAIL_TEST_RECIPIENTS:
        'Pilar.ReyesBononat@gmail.com, other@example.com',
    });
    assert.deepEqual(list, [
      'pilar.reyesbononat@gmail.com',
      'other@example.com',
    ]);
  });
});

describe('assertCorporateEmailRecipientsAllowed', () => {
  it('pasa sin allowlist', () => {
    const r = assertCorporateEmailRecipientsAllowed(['anyone@x.com'], {});
    assert.equal(r.ok, true);
  });

  it('permite destinatario de prueba', () => {
    const r = assertCorporateEmailRecipientsAllowed(
      ['pilar.reyesbononat@gmail.com'],
      {
        FF_CORPORATE_EMAIL_TEST_RECIPIENTS: 'pilar.reyesbononat@gmail.com',
      }
    );
    assert.equal(r.ok, true);
  });

  it('bloquea fuera de allowlist', () => {
    const r = assertCorporateEmailRecipientsAllowed(['otro@x.com'], {
      FF_CORPORATE_EMAIL_TEST_RECIPIENTS: 'pilar.reyesbononat@gmail.com',
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /restringido|No permitido/i);
  });
});
