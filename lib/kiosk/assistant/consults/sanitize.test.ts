import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  sanitizeConsultClientMessage,
  sanitizeConsultReply,
} from './sanitize.ts';

describe('sanitizeConsultClientMessage', () => {
  it('acepta consulta orientativa sin PII', () => {
    const r = sanitizeConsultClientMessage(
      '  ¿Tenéis  algo para  piel seca?  '
    );
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.text, '¿Tenéis algo para piel seca?');
  });

  it('rechaza vacío y demasiado largo', () => {
    assert.equal(sanitizeConsultClientMessage('').ok, false);
    assert.equal(sanitizeConsultClientMessage('a'.repeat(501)).ok, false);
  });

  it('rechaza email / teléfono aparentes', () => {
    assert.equal(
      sanitizeConsultClientMessage('Escríbeme a ana@correo.com').ok,
      false
    );
    assert.equal(
      sanitizeConsultClientMessage('Mi móvil es 612 345 678').ok,
      false
    );
  });
});

describe('sanitizeConsultReply', () => {
  it('acepta respuesta breve', () => {
    const r = sanitizeConsultReply('Acércate al mostrador con el código C-0001.');
    assert.equal(r.ok, true);
  });

  it('rechaza vacía', () => {
    assert.equal(sanitizeConsultReply('   ').ok, false);
  });
});
