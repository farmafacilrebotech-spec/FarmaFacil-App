import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  commercialPlanLabel,
  APPROVED_COMMERCIAL_PLAN_LABELS,
} from './commercial-plan-labels.ts';

describe('commercialPlanLabel', () => {
  it('maps approved commercial names', () => {
    assert.equal(commercialPlanLabel('general'), APPROVED_COMMERCIAL_PLAN_LABELS.general);
    assert.equal(
      commercialPlanLabel('personalizado'),
      APPROVED_COMMERCIAL_PLAN_LABELS.personalizado
    );
    assert.equal(
      commercialPlanLabel('asistente_ia_personalizado'),
      APPROVED_COMMERCIAL_PLAN_LABELS.asistente_ia_personalizado
    );
  });

  it('marks legacy kernel names', () => {
    assert.match(commercialPlanLabel('Starter'), /legacy/i);
    assert.match(commercialPlanLabel('Business'), /legacy/i);
  });
});
