/**
 * npm run test:membership-hierarchy
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignablePharmacyRoles,
  canAssignRole,
  canManageTargetRole,
  evaluateMembershipManagePermission,
  type MembershipActor,
} from './membership-hierarchy.ts';

const OWNER: MembershipActor = {
  kind: 'tenant',
  roleKey: 'PHARMACY_OWNER',
  profileId: 'owner-1',
};
const ADMIN: MembershipActor = {
  kind: 'tenant',
  roleKey: 'PHARMACY_ADMIN',
  profileId: 'admin-1',
};
const PLATFORM: MembershipActor = {
  kind: 'platform',
  profileId: 'platform-1',
};

describe('assignable / manage hierarchy (titulares)', () => {
  it('OWNER assigns ADMIN/PHARMACIST/STAFF but not OWNER', () => {
    assert.deepEqual(assignablePharmacyRoles(OWNER), [
      'PHARMACY_ADMIN',
      'PHARMACIST',
      'STAFF',
    ]);
    assert.equal(canAssignRole(OWNER, 'PHARMACY_OWNER'), false);
    assert.equal(canAssignRole(OWNER, 'PHARMACY_ADMIN'), true);
    assert.equal(canManageTargetRole(OWNER, 'PHARMACY_OWNER'), false);
    assert.equal(canManageTargetRole(OWNER, 'PHARMACY_ADMIN'), true);
  });

  it('ADMIN only manages PHARMACIST and STAFF', () => {
    assert.deepEqual(assignablePharmacyRoles(ADMIN), [
      'PHARMACIST',
      'STAFF',
    ]);
    assert.equal(canManageTargetRole(ADMIN, 'PHARMACIST'), true);
    assert.equal(canManageTargetRole(ADMIN, 'STAFF'), true);
    assert.equal(canManageTargetRole(ADMIN, 'PHARMACY_OWNER'), false);
    assert.equal(canManageTargetRole(ADMIN, 'PHARMACY_ADMIN'), false);
    assert.equal(canAssignRole(ADMIN, 'PHARMACY_ADMIN'), false);
  });

  it('platform manages titulares (OWNER)', () => {
    assert.equal(canManageTargetRole(PLATFORM, 'PHARMACY_OWNER'), true);
    assert.equal(canAssignRole(PLATFORM, 'PHARMACY_OWNER'), true);
  });
});

describe('self-action, peers OWNER, privilege escalation', () => {
  it('blocks self suspend/revoke/cancel', () => {
    assert.equal(
      evaluateMembershipManagePermission({
        actor: OWNER,
        targetProfileId: 'owner-1',
        targetRoleKey: 'PHARMACY_OWNER',
        action: 'suspend',
      }).ok,
      false
    );
  });

  it('allows OWNER self edit without role change', () => {
    assert.equal(
      evaluateMembershipManagePermission({
        actor: OWNER,
        targetProfileId: 'owner-1',
        targetRoleKey: 'PHARMACY_OWNER',
        action: 'edit',
        newRoleKey: 'PHARMACY_OWNER',
      }).ok,
      true
    );
  });

  it('blocks OWNER self role change', () => {
    assert.equal(
      evaluateMembershipManagePermission({
        actor: OWNER,
        targetProfileId: 'owner-1',
        targetRoleKey: 'PHARMACY_OWNER',
        action: 'edit',
        newRoleKey: 'PHARMACY_ADMIN',
      }).ok,
      false
    );
  });

  it('blocks OWNER managing another OWNER', () => {
    assert.equal(
      evaluateMembershipManagePermission({
        actor: OWNER,
        targetProfileId: 'owner-2',
        targetRoleKey: 'PHARMACY_OWNER',
        action: 'suspend',
      }).ok,
      false
    );
    assert.equal(
      evaluateMembershipManagePermission({
        actor: OWNER,
        targetProfileId: 'owner-2',
        targetRoleKey: 'PHARMACY_OWNER',
        action: 'invite',
        newRoleKey: 'PHARMACY_OWNER',
      }).ok,
      false
    );
    assert.equal(
      evaluateMembershipManagePermission({
        actor: OWNER,
        targetProfileId: 'owner-2',
        targetRoleKey: 'PHARMACY_OWNER',
        action: 'edit',
        newRoleKey: 'PHARMACY_ADMIN',
      }).ok,
      false
    );
  });

  it('allows OWNER to suspend another ADMIN', () => {
    assert.equal(
      evaluateMembershipManagePermission({
        actor: OWNER,
        targetProfileId: 'admin-1',
        targetRoleKey: 'PHARMACY_ADMIN',
        action: 'suspend',
      }).ok,
      true
    );
  });

  it('blocks ADMIN suspending OWNER or peer ADMIN', () => {
    assert.equal(
      evaluateMembershipManagePermission({
        actor: ADMIN,
        targetProfileId: 'owner-1',
        targetRoleKey: 'PHARMACY_OWNER',
        action: 'suspend',
      }).ok,
      false
    );
    assert.equal(
      evaluateMembershipManagePermission({
        actor: ADMIN,
        targetProfileId: 'admin-2',
        targetRoleKey: 'PHARMACY_ADMIN',
        action: 'revoke',
      }).ok,
      false
    );
  });

  it('platform can invite OWNER and self-role change', () => {
    assert.equal(
      evaluateMembershipManagePermission({
        actor: PLATFORM,
        targetProfileId: 'new-user',
        targetRoleKey: 'PHARMACY_OWNER',
        action: 'invite',
        newRoleKey: 'PHARMACY_OWNER',
      }).ok,
      true
    );
    assert.equal(
      evaluateMembershipManagePermission({
        actor: PLATFORM,
        targetProfileId: 'platform-1',
        targetRoleKey: 'PHARMACY_OWNER',
        action: 'edit',
        newRoleKey: 'PHARMACY_ADMIN',
      }).ok,
      true
    );
  });

  it('platform cannot self-revoke', () => {
    assert.equal(
      evaluateMembershipManagePermission({
        actor: PLATFORM,
        targetProfileId: 'platform-1',
        targetRoleKey: 'PHARMACY_OWNER',
        action: 'revoke',
      }).ok,
      false
    );
  });
});
