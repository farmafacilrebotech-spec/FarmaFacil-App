import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CONSULT_PHARMACIST_DIGITAL_HINT_REPLY,
  CONSULT_PHARMACIST_QUICK_REPLY,
  evaluateAssistantSafety,
  resolveConsultPharmacistReply,
} from './safety.ts';

describe('evaluateAssistantSafety', () => {
  it('permite orientación general de parafarmacia', () => {
    assert.equal(
      evaluateAssistantSafety('¿Qué es el cuidado personal en farmacia?').action,
      'allow'
    );
  });

  it('deriva dosis / clínica al farmacéutico', () => {
    const r = evaluateAssistantSafety('¿Qué dosis de ibuprofeno debo tomar?');
    assert.equal(r.action, 'escalate_pharmacist');
  });

  it('deriva emergencias a urgencias', () => {
    const r = evaluateAssistantSafety('Es una urgencia, no respira bien');
    assert.equal(r.action, 'escalate_emergency');
  });

  it('tiene respuesta fija para consultar farmacéutico', () => {
    assert.match(CONSULT_PHARMACIST_QUICK_REPLY, /mostrador/i);
  });
});

describe('resolveConsultPharmacistReply', () => {
  it('DEMO y sin permiso → mostrador', () => {
    assert.equal(
      resolveConsultPharmacistReply({
        mode: 'demo',
        pharmacistConsultEnabled: false,
      }),
      CONSULT_PHARMACIST_QUICK_REPLY
    );
    assert.equal(
      resolveConsultPharmacistReply({
        mode: 'contracted',
        pharmacistConsultEnabled: false,
      }),
      CONSULT_PHARMACIST_QUICK_REPLY
    );
  });

  it('CONTRATADO con permiso → orienta al botón de consulta digital', () => {
    const reply = resolveConsultPharmacistReply({
      mode: 'contracted',
      pharmacistConsultEnabled: true,
    });
    assert.equal(reply, CONSULT_PHARMACIST_DIGITAL_HINT_REPLY);
    assert.match(reply, /Consultar al farmacéutico/i);
  });
});
