/**
 * npm run test:pharmacy-access
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isHighlightedLastPharmacy,
  isOperationalMembershipStatus,
  pathForTenantRouteDecision,
  resolveLostPharmacyAccessRedirect,
  resolveTenantRouteDecision,
  type ActivePharmacyAccess,
} from './pharmacy-access-routing.ts';

const m = (
  pharmacyId: string,
  roleKey: string,
  membershipId = `mem-${pharmacyId}`
): ActivePharmacyAccess => ({
  pharmacyId,
  roleKey,
  roleName: roleKey,
  membershipId,
});

describe('resolveTenantRouteDecision', () => {
  it('0 farmacias active → none', () => {
    assert.deepEqual(
      resolveTenantRouteDecision({ activeMemberships: [] }),
      { kind: 'none' }
    );
  });

  it('1 farmacia active → single (entra directo)', () => {
    assert.deepEqual(
      resolveTenantRouteDecision({
        activeMemberships: [m('a', 'PHARMACY_OWNER')],
      }),
      { kind: 'single', pharmacyId: 'a' }
    );
  });

  it('≥2 farmacias → select siempre (incluso con last_pharmacy)', () => {
    assert.deepEqual(
      resolveTenantRouteDecision({
        activeMemberships: [
          m('a', 'PHARMACY_OWNER'),
          m('b', 'STAFF'),
        ],
      }),
      { kind: 'select' }
    );
  });

  it('OWNER en A + STAFF en B: roles independientes; login → selector', () => {
    const memberships = [
      m('farmacia-a', 'PHARMACY_OWNER'),
      m('farmacia-b', 'STAFF'),
    ];
    const decision = resolveTenantRouteDecision({
      activeMemberships: memberships,
    });
    assert.equal(decision.kind, 'select');
    assert.equal(memberships[0].roleKey, 'PHARMACY_OWNER');
    assert.equal(memberships[1].roleKey, 'STAFF');
  });
});

describe('isHighlightedLastPharmacy', () => {
  it('destaca solo si last_pharmacy sigue active', () => {
    assert.equal(
      isHighlightedLastPharmacy({
        pharmacyId: 'b',
        lastPharmacyId: 'b',
        activePharmacyIds: ['a', 'b'],
      }),
      true
    );
    assert.equal(
      isHighlightedLastPharmacy({
        pharmacyId: 'a',
        lastPharmacyId: 'b',
        activePharmacyIds: ['a', 'b'],
      }),
      false
    );
    assert.equal(
      isHighlightedLastPharmacy({
        pharmacyId: 'gone',
        lastPharmacyId: 'gone',
        activePharmacyIds: ['a', 'b'],
      }),
      false
    );
  });
});

describe('pathForTenantRouteDecision', () => {
  it('mapea a rutas /f/... o selector', () => {
    assert.equal(
      pathForTenantRouteDecision({ kind: 'single', pharmacyId: 'a' }),
      '/f/a/dashboard'
    );
    assert.equal(
      pathForTenantRouteDecision({ kind: 'select' }),
      '/auth/select-pharmacy'
    );
    assert.equal(pathForTenantRouteDecision({ kind: 'none' }), null);
  });
});

describe('resolveLostPharmacyAccessRedirect', () => {
  it('si queda una active distinta → esa farmacia (sin selector)', () => {
    assert.equal(
      resolveLostPharmacyAccessRedirect({
        failedPharmacyId: 'gone',
        activeMemberships: [m('still', 'STAFF')],
      }),
      '/f/still/dashboard'
    );
  });

  it('si quedan varias → selector', () => {
    assert.equal(
      resolveLostPharmacyAccessRedirect({
        failedPharmacyId: 'gone',
        activeMemberships: [m('a', 'OWNER'), m('b', 'STAFF')],
      }),
      '/auth/select-pharmacy'
    );
  });

  it('si no queda ninguna → access-denied', () => {
    assert.equal(
      resolveLostPharmacyAccessRedirect({
        failedPharmacyId: 'gone',
        activeMemberships: [],
      }),
      '/access-denied'
    );
  });
});

describe('isOperationalMembershipStatus', () => {
  it('solo active es operativo; invited/revoked/suspended no', () => {
    assert.equal(isOperationalMembershipStatus('active'), true);
    assert.equal(isOperationalMembershipStatus('invited'), false);
    assert.equal(isOperationalMembershipStatus('revoked'), false);
    assert.equal(isOperationalMembershipStatus('suspended'), false);
  });
});
