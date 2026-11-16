import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { selectContractTemplateKey } from './select-template';

describe('selectContractTemplateKey', () => {
  it('elige full-kiosk si hay kioscos', () => {
    assert.equal(
      selectContractTemplateKey({ planId: 'general', kioskCount: 1 }),
      'full-kiosk'
    );
    assert.equal(
      selectContractTemplateKey({
        planId: 'ai_personalized',
        kioskCount: 2,
      }),
      'full-kiosk'
    );
  });

  it('elige catalog-ai para plan IA sin kiosco', () => {
    assert.equal(
      selectContractTemplateKey({
        planId: 'ai_personalized',
        kioskCount: 0,
      }),
      'catalog-ai'
    );
  });

  it('elige catalog para general/personalizado sin kiosco', () => {
    assert.equal(
      selectContractTemplateKey({ planId: 'general', kioskCount: 0 }),
      'catalog'
    );
    assert.equal(
      selectContractTemplateKey({ planId: 'personalized', kioskCount: 0 }),
      'catalog'
    );
  });
});
