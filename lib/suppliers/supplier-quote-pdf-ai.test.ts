/**
 * node --experimental-strip-types --test lib/suppliers/supplier-quote-pdf-ai.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isSupplierQuotePdfAiEnabled } from './supplier-quote-pdf-ai.ts';

describe('isSupplierQuotePdfAiEnabled', () => {
  it('está OFF por defecto aunque exista OPENAI_API_KEY', () => {
    assert.equal(
      isSupplierQuotePdfAiEnabled({
        OPENAI_API_KEY: 'sk-test',
        OPENAI_MODEL: 'gpt-4o-mini',
      } as NodeJS.ProcessEnv),
      false
    );
  });

  it('solo se activa con flag explícito', () => {
    assert.equal(
      isSupplierQuotePdfAiEnabled({
        OPENAI_API_KEY: 'sk-test',
        SUPPLIER_QUOTE_PDF_AI_ENABLED: '1',
      } as NodeJS.ProcessEnv),
      true
    );
    assert.equal(
      isSupplierQuotePdfAiEnabled({
        SUPPLIER_QUOTE_PDF_AI_ENABLED: 'true',
      } as NodeJS.ProcessEnv),
      true
    );
  });
});
