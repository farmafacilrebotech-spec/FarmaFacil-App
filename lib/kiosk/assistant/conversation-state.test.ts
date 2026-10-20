import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ASSISTANT_IDLE_MS,
  bindConversationToSession,
  conversationHasClientTurn,
  emptyAssistantConversation,
  isConversationIdle,
  parseStoredConversation,
  serializeConversation,
} from './conversation-state.ts';

const BINDING_A = {
  pharmacyId: 'ph-a',
  deviceId: 'dev-a',
  sessionId: 'sess-a',
};

const BINDING_B = {
  pharmacyId: 'ph-b',
  deviceId: 'dev-a',
  sessionId: 'sess-a',
};

describe('assistant conversation-state', () => {
  it('empty empieza con bienvenida y sin turno de cliente', () => {
    const state = emptyAssistantConversation('Hola', BINDING_A);
    assert.equal(state.messages.length, 1);
    assert.equal(conversationHasClientTurn(state), false);
    assert.equal(state.pharmacyId, 'ph-a');
  });

  it('inactividad solo si hay conversación real', () => {
    const welcome = emptyAssistantConversation('Hola', BINDING_A);
    assert.equal(
      isConversationIdle(
        { ...welcome, updatedAt: Date.now() - ASSISTANT_IDLE_MS - 1 },
        Date.now()
      ),
      false
    );

    const withTurn = {
      ...welcome,
      messages: [
        ...welcome.messages,
        { role: 'user' as const, content: 'Busco crema' },
      ],
      updatedAt: Date.now() - ASSISTANT_IDLE_MS - 1,
    };
    assert.equal(isConversationIdle(withTurn, Date.now()), true);
  });

  it('bind limpia si cambia farmacia o sesión', () => {
    const state = {
      ...emptyAssistantConversation('Hola', BINDING_A),
      messages: [
        { role: 'assistant' as const, content: 'Hola' },
        { role: 'user' as const, content: 'Hola' },
      ],
    };
    const rebound = bindConversationToSession(state, BINDING_B, 'Bienvenida');
    assert.equal(rebound.pharmacyId, 'ph-b');
    assert.equal(rebound.messages.length, 1);
    assert.equal(rebound.messages[0].content, 'Bienvenida');

    const same = bindConversationToSession(state, BINDING_A, 'Otro');
    assert.equal(same.messages.length, 2);
  });

  it('parse/serialize conserva mensajes y tarjetas', () => {
    const state = {
      ...emptyAssistantConversation('Hola', BINDING_A),
      messages: [
        { role: 'assistant' as const, content: 'Hola' },
        { role: 'user' as const, content: 'Crema' },
        { role: 'assistant' as const, content: 'Te muestro opciones' },
      ],
      productsByMessage: {
        '2': [
          {
            id: 'p1',
            name: 'Crema',
            brand: null,
            price: 10,
            stock: 3,
            available: true,
            canAddToCart: true,
            imageUrl: null,
          },
        ],
      },
      activeConsults: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          displayCode: 'C-0001',
          replyDelivered: false,
        },
      ],
    };
    const parsed = parseStoredConversation(serializeConversation(state));
    assert.ok(parsed);
    assert.equal(parsed!.messages.length, 3);
    assert.equal(parsed!.productsByMessage['2']?.[0]?.name, 'Crema');
    assert.equal(parsed!.activeConsults[0]?.displayCode, 'C-0001');
  });

  it('parse rechaza payload corrupto o sin binding', () => {
    assert.equal(parseStoredConversation('no-json'), null);
    assert.equal(parseStoredConversation('{"messages":[]}'), null);
    assert.equal(
      parseStoredConversation(
        JSON.stringify({
          pharmacyId: 'x',
          messages: [{ role: 'assistant', content: 'Hola' }],
        })
      ),
      null
    );
  });
});
