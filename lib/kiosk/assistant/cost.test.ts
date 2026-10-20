import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { estimateAssistantCostCents } from './cost.ts';

describe('estimateAssistantCostCents', () => {
  it('estima coste positivo con tokens', () => {
    const c = estimateAssistantCostCents({
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });
    assert.ok(c > 0);
  });

  it('cero sin tokens', () => {
    assert.equal(
      estimateAssistantCostCents({ promptTokens: 0, completionTokens: 0 }),
      0
    );
  });
});
