import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCustomerLoginIdentifier,
  validateCustomerRegister,
} from './validation.ts';

describe('customer validation', () => {
  it('exige privacidad y contraseñas coincidentes', () => {
    const bad = validateCustomerRegister({
      firstName: 'Ana',
      lastName: 'García',
      phone: '612345678',
      email: 'ana@example.com',
      password: 'secreto12',
      passwordConfirm: 'otra',
      privacyAccepted: true,
      marketingConsent: false,
    });
    assert.equal(bad.ok, false);

    const noPrivacy = validateCustomerRegister({
      firstName: 'Ana',
      lastName: 'García',
      phone: '612345678',
      email: 'ana@example.com',
      password: 'secreto12',
      passwordConfirm: 'secreto12',
      privacyAccepted: false,
      marketingConsent: true,
    });
    assert.equal(noPrivacy.ok, false);

    const ok = validateCustomerRegister({
      firstName: 'Ana',
      lastName: 'García',
      phone: '612345678',
      email: 'ana@example.com',
      password: 'secreto12',
      passwordConfirm: 'secreto12',
      privacyAccepted: true,
      marketingConsent: false,
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.marketingConsent, false);
      assert.equal(ok.phone, '612345678');
    }
  });

  it('login solo por email (no phone auth)', () => {
    const email = normalizeCustomerLoginIdentifier('Ana@Example.com');
    assert.equal(email.ok, true);
    if (email.ok) assert.equal(email.email, 'ana@example.com');

    const phone = normalizeCustomerLoginIdentifier('612345678');
    assert.equal(phone.ok, false);
  });
});
