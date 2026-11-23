import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeAvailableSkuKeys, isPaidSkuAvailable } from './available-skus.ts';

const ALL_TECH = ['starter', 'general', 'personalizado', 'asistente_ia_personalizado'];

describe('computeAvailableSkuKeys', () => {
  it('todos disponibles con SKUs activos y planes técnicos', () => {
    const r = computeAvailableSkuKeys({
      skuRows: [
        { key: 'pilot', is_active: true },
        { key: 'general', is_active: true },
        { key: 'personalized', is_active: true },
        { key: 'ai_personalized', is_active: true },
      ],
      activeTechnicalPlanKeys: ALL_TECH,
    });
    assert.deepEqual([...r].sort(), ['ai_personalized', 'general', 'personalized', 'pilot']);
  });

  it('excluye SKU inactivo', () => {
    const r = computeAvailableSkuKeys({
      skuRows: [
        { key: 'general', is_active: true },
        { key: 'personalized', is_active: false },
        { key: 'ai_personalized', is_active: true },
      ],
      activeTechnicalPlanKeys: ALL_TECH,
    });
    assert.ok(!r.includes('personalized'));
    assert.ok(r.includes('general'));
  });

  it('excluye SKU sin plan técnico (technical_plan_missing)', () => {
    const r = computeAvailableSkuKeys({
      skuRows: [
        { key: 'general', is_active: true },
        { key: 'ai_personalized', is_active: true },
      ],
      activeTechnicalPlanKeys: ['starter', 'general'],
    });
    assert.deepEqual(r, ['general']);
  });

  it('sin lectura de SKUs valida solo plan técnico', () => {
    const r = computeAvailableSkuKeys({
      skuRows: null,
      activeTechnicalPlanKeys: ['general'],
    });
    assert.deepEqual(r, ['general']);
  });
});

describe('isPaidSkuAvailable', () => {
  it('null no filtra; lista filtra', () => {
    assert.equal(isPaidSkuAvailable(null, 'general'), true);
    assert.equal(isPaidSkuAvailable(['general'], 'personalized'), false);
    assert.equal(isPaidSkuAvailable(['general'], 'general'), true);
  });
});
