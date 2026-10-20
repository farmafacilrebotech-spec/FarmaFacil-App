import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getAssistantOpenAiConfig } from './config.ts';

describe('getAssistantOpenAiConfig', () => {
  it('falla sin API key', () => {
    const r = getAssistantOpenAiConfig({} as NodeJS.ProcessEnv);
    assert.equal(r.ok, false);
  });

  it('usa modelo configurable', () => {
    const r = getAssistantOpenAiConfig({
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: 'gpt-test-model',
    } as NodeJS.ProcessEnv);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.model, 'gpt-test-model');
      assert.equal(r.apiKey, 'sk-test');
    }
  });
});
