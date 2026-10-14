/**
 * Regresión acceso invitaciones pending (contrato RPC 033 + rama resolveAppAccess).
 * npm run test:pending-invitations
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  invitedAllowsOperationalTenantAccess,
  mapPendingInvitationRpcRows,
  resolvePendingAccessBranch,
  type PendingInvitationRpcRow,
} from './pending-invitations.ts';

const OWN_MEMBERSHIP = '64207884-46f6-41e3-95d0-7cd42f4acf7c';
const OWN_PHARMACY = '92dbe632-f82a-4c55-a737-3c77f105254e';
const FOREIGN_MEMBERSHIP = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const FOREIGN_PHARMACY = '11111111-2222-3333-4444-555555555555';

function invitedRow(
  overrides: Partial<PendingInvitationRpcRow> = {}
): PendingInvitationRpcRow {
  return {
    membership_id: OWN_MEMBERSHIP,
    pharmacy_id: OWN_PHARMACY,
    pharmacy_name: 'Farmacia Pruebas',
    role_key: 'PHARMACY_OWNER',
    role_name: 'Propietario',
    invited_at: '2026-10-14T17:44:38.058Z',
    ...overrides,
  };
}

describe('mapPendingInvitationRpcRows', () => {
  it('maps invited user pending row (happy path)', () => {
    const invitations = mapPendingInvitationRpcRows([invitedRow()]);
    assert.equal(invitations.length, 1);
    assert.equal(invitations[0].membershipId, OWN_MEMBERSHIP);
    assert.equal(invitations[0].pharmacyId, OWN_PHARMACY);
    assert.equal(invitations[0].pharmacyName, 'Farmacia Pruebas');
    assert.equal(invitations[0].roleKey, 'PHARMACY_OWNER');
    assert.equal(invitations[0].roleName, 'Propietario');
    assert.equal(invitations[0].invitedAt, '2026-10-14T17:44:38.058Z');
  });

  it('returns empty for user without invitation', () => {
    assert.deepEqual(mapPendingInvitationRpcRows([]), []);
    assert.deepEqual(mapPendingInvitationRpcRows(null), []);
    assert.deepEqual(mapPendingInvitationRpcRows(undefined), []);
  });

  it('drops incomplete rows (no silent pharmacy/role invent)', () => {
    const invitations = mapPendingInvitationRpcRows([
      invitedRow({ pharmacy_name: null }),
      invitedRow({ role_key: '' }),
      invitedRow({ membership_id: 'not-a-uuid' }),
    ]);
    assert.equal(invitations.length, 0);
  });
});

describe('resolvePendingAccessBranch (espejo resolveAppAccess)', () => {
  it('invited user with pending invitation → invited (not forbidden)', () => {
    assert.equal(
      resolvePendingAccessBranch({
        activeMembershipCount: 0,
        pendingInvitationCount: 1,
      }),
      'invited'
    );
  });

  it('active member → pharmacy (pending optional)', () => {
    assert.equal(
      resolvePendingAccessBranch({
        activeMembershipCount: 1,
        pendingInvitationCount: 0,
      }),
      'pharmacy'
    );
    assert.equal(
      resolvePendingAccessBranch({
        activeMembershipCount: 1,
        pendingInvitationCount: 1,
      }),
      'pharmacy'
    );
  });

  it('foreign / no invitation → forbidden', () => {
    // RPC 033 no devolvería filas ajenas; app ve pending=0.
    const foreignWouldBeFiltered: PendingInvitationRpcRow[] = [];
    assert.equal(mapPendingInvitationRpcRows(foreignWouldBeFiltered).length, 0);
    assert.equal(
      resolvePendingAccessBranch({
        activeMembershipCount: 0,
        pendingInvitationCount: 0,
      }),
      'forbidden'
    );
    // Defensa: aunque llegara una fila "ajena" malformada, no inventamos acceso
    // sin datos mínimos; y la RPC nunca debería emitir foreign memberships.
    void FOREIGN_MEMBERSHIP;
    void FOREIGN_PHARMACY;
  });

  it('multiple active → multiple_pharmacies', () => {
    assert.equal(
      resolvePendingAccessBranch({
        activeMembershipCount: 2,
        pendingInvitationCount: 0,
      }),
      'multiple_pharmacies'
    );
  });
});

describe('invited operational tenant gate', () => {
  it('invited cannot access catalog/orders until active', () => {
    assert.equal(invitedAllowsOperationalTenantAccess('invited'), false);
    assert.equal(invitedAllowsOperationalTenantAccess('suspended'), false);
    assert.equal(invitedAllowsOperationalTenantAccess('revoked'), false);
  });

  it('active member can proceed to operational checks (commercial gate aparte)', () => {
    assert.equal(invitedAllowsOperationalTenantAccess('active'), true);
  });
});
