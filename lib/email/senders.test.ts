import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertAuthorizedSenderKey,
  listAuthorizedSenders,
  resolveAuthorizedSenderDomain,
} from './senders.ts';

describe('corporate senders', () => {
  it('lista remitentes del dominio farmafacil.solutions', () => {
    const list = listAuthorizedSenders({
      EMAIL_FROM: 'Pilar <pilar@farmafacil.solutions>',
    });
    assert.ok(list.length >= 8);
    assert.ok(list.some((s) => s.key === 'pilar' && s.isDefault));
    assert.equal(
      list.every((s) => s.email.endsWith('@farmafacil.solutions')),
      true
    );
  });

  it('rechaza clave arbitraria', () => {
    const r = assertAuthorizedSenderKey('hacker', {
      EMAIL_FROM: 'pilar@farmafacil.solutions',
    });
    assert.equal(r.ok, false);
  });

  it('respeta allowlist de claves', () => {
    const list = listAuthorizedSenders({
      EMAIL_FROM: 'pilar@farmafacil.solutions',
      FF_CORPORATE_EMAIL_ALLOWED_FROM_KEYS: 'pilar,pruebas',
    });
    assert.deepEqual(
      list.map((s) => s.key).sort(),
      ['pilar', 'pruebas']
    );
  });

  it('dominio desde EMAIL_FROM', () => {
    assert.equal(
      resolveAuthorizedSenderDomain({
        EMAIL_FROM: 'x@farmafacil.solutions',
      }),
      'farmafacil.solutions'
    );
  });
});
