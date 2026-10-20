import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canReserveQuota,
  demoSafePromptSettings,
  pharmacyMayUpdatePharmacistConsult,
  resolveQuotaAfterProviderCall,
} from './turn-gates.ts';

describe('canReserveQuota', () => {
  it('exige OpenAI configurado antes de reservar', () => {
    const r = canReserveQuota({
      openAiConfigured: false,
      moduleUsable: true,
      limitExceeded: false,
    });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'config_missing');
  });

  it('bloquea sin módulo o con cuota agotada', () => {
    assert.equal(
      canReserveQuota({
        openAiConfigured: true,
        moduleUsable: false,
        limitExceeded: false,
      }).ok,
      false
    );
    const lim = canReserveQuota({
      openAiConfigured: true,
      moduleUsable: true,
      limitExceeded: true,
    });
    assert.equal(lim.ok, false);
    if (!lim.ok) assert.equal(lim.reason, 'limit_exceeded');
  });

  it('permite reservar si todo está listo', () => {
    assert.equal(
      canReserveQuota({
        openAiConfigured: true,
        moduleUsable: true,
        limitExceeded: false,
      }).ok,
      true
    );
  });
});

describe('resolveQuotaAfterProviderCall', () => {
  it('libera reserva si OpenAI falla', () => {
    assert.equal(
      resolveQuotaAfterProviderCall({ reserved: true, providerOk: false }),
      'release_reservation'
    );
  });

  it('finaliza uso si OpenAI ok', () => {
    assert.equal(
      resolveQuotaAfterProviderCall({ reserved: true, providerOk: true }),
      'finalize_usage'
    );
  });

  it('no libera si no hubo reserva', () => {
    assert.equal(
      resolveQuotaAfterProviderCall({ reserved: false, providerOk: false }),
      'no_reservation'
    );
  });
});

describe('demoSafePromptSettings', () => {
  it('vacía FAQs/servicios/instrucciones en DEMO', () => {
    const s = demoSafePromptSettings({
      mode: 'demo',
      settings: {
        assistantName: 'Lola secreta',
        customInstructions: 'NO filtrar',
        faqs: [{ question: 'privada?', answer: 'sí' }],
        servicesInfo: 'secreto',
        hoursInfo: 'secreto',
      },
    });
    assert.equal(s.customInstructions, '');
    assert.equal(s.faqs.length, 0);
    assert.equal(s.servicesInfo, '');
    assert.equal(s.hoursInfo, '');
    assert.match(s.assistantName, /demo/i);
  });

  it('conserva settings en contratado', () => {
    const s = demoSafePromptSettings({
      mode: 'contracted',
      settings: {
        assistantName: 'Lola',
        customInstructions: 'Sé breve',
        faqs: [{ question: '¿Horario?', answer: '9-21' }],
        servicesInfo: 'Tensión',
        hoursInfo: 'L-V',
      },
    });
    assert.equal(s.assistantName, 'Lola');
    assert.equal(s.faqs.length, 1);
  });
});

describe('pharmacyMayUpdatePharmacistConsult', () => {
  it('niega mutación comercial a la farmacia', () => {
    assert.equal(pharmacyMayUpdatePharmacistConsult(), false);
  });
});
