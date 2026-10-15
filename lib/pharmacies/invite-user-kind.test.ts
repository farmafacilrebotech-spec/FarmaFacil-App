/**
 * Clasificación new/existing para reenvío de invitaciones.
 * npm run test:invite-user-kind
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyInviteUserKind } from './invite-user-kind-logic.ts';

describe('classifyInviteUserKind', () => {
  it('solo invited (alta pendiente / first-access) → new', () => {
    assert.equal(classifyInviteUserKind(['invited']), 'new');
    assert.equal(classifyInviteUserKind(['invited', 'invited']), 'new');
    assert.equal(classifyInviteUserKind([]), 'new');
  });

  it('active en alguna farmacia → existing (reutilizable)', () => {
    assert.equal(classifyInviteUserKind(['active']), 'existing');
    assert.equal(classifyInviteUserKind(['invited', 'active']), 'existing');
  });

  it('suspended o revoked → existing (no re-invitar Auth)', () => {
    assert.equal(classifyInviteUserKind(['suspended']), 'existing');
    assert.equal(classifyInviteUserKind(['revoked']), 'existing');
    assert.equal(classifyInviteUserKind(['invited', 'revoked']), 'existing');
  });

  it('caso Farmacia Pruebas: una membership invited OWNER → new', () => {
    // Resend debe clasificar new y enviar email; no fallar por service_role SELECT.
    assert.equal(classifyInviteUserKind(['invited']), 'new');
  });
});
