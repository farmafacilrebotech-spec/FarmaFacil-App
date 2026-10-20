import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sanitizeAssistantSettingsInput } from './settings-input.ts';

describe('sanitizeAssistantSettingsInput', () => {
  it('acepta valores válidos y recorta faqs', () => {
    const r = sanitizeAssistantSettingsInput({
      assistantName: 'Lola',
      welcomeMessage: 'Hola',
      customInstructions: 'Sé breve',
      faqs: [
        { question: '¿Horario?', answer: '9-21' },
        { question: '', answer: 'ignorada' },
      ],
      servicesInfo: 'Tensión',
      hoursInfo: 'L-V',
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.assistantName, 'Lola');
      assert.equal(r.value.faqs.length, 1);
    }
  });

  it('rechaza nombre demasiado largo', () => {
    const r = sanitizeAssistantSettingsInput({
      assistantName: 'x'.repeat(81),
    });
    assert.equal(r.ok, false);
  });
});
