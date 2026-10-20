import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { callOpenAiChatCompletion } from './openai.ts';

describe('callOpenAiChatCompletion', () => {
  it('mapea respuesta ok del proveedor', async () => {
    const r = await callOpenAiChatCompletion({
      config: {
        ok: true,
        apiKey: 'sk-test',
        model: 'gpt-test',
        timeoutMs: 5_000,
        baseUrl: 'https://example.test/v1',
      },
      systemPrompt: 'sys',
      messages: [{ role: 'user', content: 'hola' }],
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'Hola, ¿en qué te ayudo?' } }],
          }),
          { status: 200 }
        ),
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.match(r.content, /Hola/);
  });

  it('trata status no-ok como provider_error sin filtrar secrets', async () => {
    const r = await callOpenAiChatCompletion({
      config: {
        ok: true,
        apiKey: 'sk-test',
        model: 'gpt-test',
        timeoutMs: 5_000,
        baseUrl: 'https://example.test/v1',
      },
      systemPrompt: 'sys',
      messages: [{ role: 'user', content: 'hola' }],
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: { message: 'secret' } }), {
          status: 401,
        }),
    });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, 'provider_error');
      assert.equal(/secret|sk-test/i.test(r.message), false);
    }
  });
});
