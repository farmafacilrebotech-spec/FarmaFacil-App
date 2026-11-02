import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_KIND_CHANGE_TOKENS,
  isCustomerCapable,
  isCustomerOnlyKind,
  isNonDestructivePlatformKindTransition,
  kindFromSignupMetadata,
  looksLikeObfuscatedExistingSignup,
  nextKindAfterCustomerEnable,
  nextKindAfterInviteAccept,
  normalizeAccountKind,
  resolveAccountKindAccessGate,
  xorRollbackBlockedByBothCount,
} from './account-kind.ts';

describe('account_kind dual-role (071)', () => {
  it('1) staff → both mediante activación voluntaria', () => {
    assert.equal(nextKindAfterCustomerEnable('staff'), 'both');
    assert.equal(ACCOUNT_KIND_CHANGE_TOKENS.enableSelf, 'enable_self_v1');
  });

  it('2) customer → both mediante aceptación de invitación válida', () => {
    assert.equal(nextKindAfterInviteAccept('customer'), 'both');
    assert.equal(nextKindAfterInviteAccept('staff'), 'staff');
    assert.equal(nextKindAfterInviteAccept('both'), 'both');
    assert.equal(
      ACCOUNT_KIND_CHANGE_TOKENS.acceptMembership,
      'accept_membership_v1'
    );
  });

  it('3) registro con metadata both no obtiene doble rol', () => {
    assert.equal(kindFromSignupMetadata('both'), 'staff');
    assert.equal(kindFromSignupMetadata('BOTH'), 'staff');
    assert.equal(kindFromSignupMetadata('customer'), 'customer');
    assert.equal(kindFromSignupMetadata('staff'), 'staff');
    assert.equal(kindFromSignupMetadata(''), 'staff');
  });

  it('4) staff conserva acceso a farmacias (gate no corta staff/both)', () => {
    assert.equal(
      resolveAccountKindAccessGate({
        accountKind: 'staff',
        activeMembershipCount: 1,
        pendingInvitationCount: 0,
      }),
      'pharmacy'
    );
    assert.equal(
      resolveAccountKindAccessGate({
        accountKind: 'both',
        activeMembershipCount: 2,
        pendingInvitationCount: 0,
      }),
      'multiple_pharmacies'
    );
  });

  it('5) customer conserva área cliente sin memberships', () => {
    assert.equal(isCustomerCapable('customer'), true);
    assert.equal(
      resolveAccountKindAccessGate({
        accountKind: 'customer',
        activeMembershipCount: 0,
        pendingInvitationCount: 0,
      }),
      'customer'
    );
  });

  it('6) both accede a ambas áreas (cliente + panel vía memberships)', () => {
    assert.equal(isCustomerCapable('both'), true);
    assert.equal(isCustomerOnlyKind('both'), false);
    assert.equal(
      resolveAccountKindAccessGate({
        accountKind: 'both',
        activeMembershipCount: 1,
        pendingInvitationCount: 0,
      }),
      'pharmacy'
    );
  });

  it('7) invitación pendiente no concede pharmacy; rechazada (=0) tampoco', () => {
    assert.equal(
      resolveAccountKindAccessGate({
        accountKind: 'customer',
        activeMembershipCount: 0,
        pendingInvitationCount: 1,
      }),
      'invited'
    );
    assert.equal(
      resolveAccountKindAccessGate({
        accountKind: 'customer',
        activeMembershipCount: 0,
        pendingInvitationCount: 0,
      }),
      'customer'
    );
    assert.notEqual(
      resolveAccountKindAccessGate({
        accountKind: 'staff',
        activeMembershipCount: 0,
        pendingInvitationCount: 1,
      }),
      'pharmacy'
    );
  });

  it('8) aislamiento semántico: gates propios no cruzan perfiles', () => {
    // account_kind helpers no autorizan IDs ajenos; RPCs usan auth.uid().
    assert.equal(normalizeAccountKind('customer'), 'customer');
    assert.equal(isCustomerCapable('staff'), false);
  });

  it('9) recovery detecta both y no degrada en silencio', () => {
    assert.equal(xorRollbackBlockedByBothCount(0), false);
    assert.equal(xorRollbackBlockedByBothCount(1), true);
    assert.equal(xorRollbackBlockedByBothCount(3), true);
    assert.equal(
      isNonDestructivePlatformKindTransition('staff', 'both'),
      true
    );
    assert.equal(
      isNonDestructivePlatformKindTransition('both', 'staff'),
      false
    );
    assert.equal(
      isNonDestructivePlatformKindTransition('customer', 'staff'),
      false
    );
  });

  it('signup ofuscado y enable no degradan customer', () => {
    assert.equal(nextKindAfterCustomerEnable('customer'), 'customer');
    assert.equal(nextKindAfterCustomerEnable('both'), 'both');
    assert.equal(
      looksLikeObfuscatedExistingSignup({
        session: null,
        user: { identities: [] },
      }),
      true
    );
  });
});
