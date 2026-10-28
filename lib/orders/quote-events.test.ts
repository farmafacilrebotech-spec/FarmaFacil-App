import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  QUOTE_EVENT_TYPE_LABELS,
  QUOTE_EVENT_TYPES,
} from './quote-event-labels.ts';

describe('quote event labels', () => {
  it('cubre todos los event_type de 062', () => {
    for (const t of QUOTE_EVENT_TYPES) {
      assert.ok(QUOTE_EVENT_TYPE_LABELS[t], `falta label para ${t}`);
    }
  });
});
