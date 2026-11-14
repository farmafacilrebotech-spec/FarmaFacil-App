import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertCorporateSendPolicy,
  defaultPurposeForTemplate,
  resolveEffectivePurpose,
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

  it('permite comercial manual sin Cartera (aviso no bloqueante)', () => {
    const r = assertCorporateSendPolicy({
      ...base,
      purpose: 'commercial',
      commercialAuthAck: false,
      oppositionChecked: false,
      legalBasis: null,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.ok(r.commercialNotice);
      assert.equal(r.legalBasis, null);
    }
  });

  it('EMAIL-02 visualTest omite gates y no inventa consentimiento', () => {
    const r = assertCorporateSendPolicy({
      ...base,
      purpose: 'commercial',
      commercialAuthAck: false,
      oppositionChecked: false,
      legalBasis: null,
      visualTestSend: true,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.visualTestSend, true);
      assert.equal(r.legalBasis, null);
      assert.equal(r.commercialNotice, null);
    }
  });

  it('bloquea destinatario en oposición', () => {
    const r = assertCorporateSendPolicy({
      ...base,
      purpose: 'commercial',
      recipientSuppressed: true,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, 'recipient_suppressed');
  });

  it('defaultPurposeForTemplate', () => {
    assert.equal(defaultPurposeForTemplate('demo'), 'commercial');
    assert.equal(defaultPurposeForTemplate('piloto'), 'commercial');
    assert.equal(defaultPurposeForTemplate('lanzadera'), 'institutional');
    assert.equal(defaultPurposeForTemplate('imprentas'), 'procurement');
    assert.equal(defaultPurposeForTemplate('blank'), 'operational');
  });

  it('lanzadera es institucional', () => {
    assert.equal(
      resolveEffectivePurpose('lanzadera', 'operational'),
      'institutional'
    );
    const r = assertCorporateSendPolicy({
      ...base,
      purpose: 'operational',
      templateSlug: 'lanzadera',
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.purpose, 'institutional');
  });

  it('imprentas es aprovisionamiento', () => {
    assert.equal(
      resolveEffectivePurpose('imprentas', 'commercial'),
      'procurement'
    );
  });

  it('demo fuerza propósito comercial pero no bloquea el envío', () => {
    assert.equal(
      resolveEffectivePurpose('demo', 'operational'),
      'commercial'
    );
    const r = assertCorporateSendPolicy({
      ...base,
      purpose: 'operational',
      templateSlug: 'demo',
      commercialAuthAck: false,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.purpose, 'commercial');
      assert.ok(r.commercialNotice);
    }
  });
});
