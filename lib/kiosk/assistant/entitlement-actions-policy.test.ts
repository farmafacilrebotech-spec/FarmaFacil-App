import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isAssistantSuperAdminAction,
  pharmacyMayRunAssistantCommercialAction,
} from './entitlement-actions-policy.ts';

describe('assistant commercial actions policy', () => {
  it('reconoce acciones SuperAdmin demo y contratado', () => {
    assert.equal(isAssistantSuperAdminAction('activate_demo'), true);
    assert.equal(isAssistantSuperAdminAction('activate_contracted'), true);
    assert.equal(isAssistantSuperAdminAction('update_limits'), true);
    assert.equal(isAssistantSuperAdminAction('hack_limit'), false);
  });

  it('rechaza cualquier acción comercial desde farmacia', () => {
    assert.equal(
      pharmacyMayRunAssistantCommercialAction('activate_demo'),
      false
    );
    assert.equal(
      pharmacyMayRunAssistantCommercialAction('activate_contracted'),
      false
    );
    assert.equal(
      pharmacyMayRunAssistantCommercialAction('update_limits'),
      false
    );
  });
});
