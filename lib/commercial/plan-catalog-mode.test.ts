import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  expectedCatalogModeForPlan,
  PLAN_ASSIGN_RPC_STATUS,
  PLAN_CATALOG_EXPECTATIONS,
} from './plan-catalog-mode.ts';

describe('plan → catalog_mode expectations', () => {
  it('mapea piloto y general a generic; personalizados a own', () => {
    assert.equal(expectedCatalogModeForPlan('piloto'), 'generic');
    assert.equal(expectedCatalogModeForPlan('general'), 'generic');
    assert.equal(expectedCatalogModeForPlan('personalizado'), 'own');
    assert.equal(
      expectedCatalogModeForPlan('asistente_ia_personalizado'),
      'own'
    );
  });

  it('asistente personalizado solo en plan IA', () => {
    const ai = PLAN_CATALOG_EXPECTATIONS.find(
      (p) => p.planCode === 'asistente_ia_personalizado'
    );
    assert.ok(ai);
    assert.equal(ai!.assistantPersonalized, true);
    assert.equal(
      PLAN_CATALOG_EXPECTATIONS.filter((p) => p.assistantPersonalized).length,
      1
    );
  });

  it('documenta que assign RPC aún no existe', () => {
    assert.equal(PLAN_ASSIGN_RPC_STATUS.exists, false);
    assert.match(
      PLAN_ASSIGN_RPC_STATUS.draftMigration,
      /056_commercial_plan_assign/
    );
    assert.ok(
      PLAN_ASSIGN_RPC_STATUS.interimRpcs.includes('ff_attach_master_catalog_v1')
    );
  });
});
