import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findMembershipByEmailInPharmacy } from './invite-membership-lookup.ts';

describe('findMembershipByEmailInPharmacy', () => {
  const rows = [
    {
      id: 'm1',
      status: 'active',
      accepted_at: '2024-01-01T00:00:00Z',
      profiles: { email: 'owner@farmacia.es' },
    },
    {
      id: 'm2',
      status: 'invited',
      accepted_at: null,
      profiles: [{ email: 'staff@farmacia.es' }],
    },
    {
      id: 'm3',
      status: 'revoked',
      accepted_at: '2024-06-01T00:00:00Z',
      profiles: { email: 'old@farmacia.es' },
    },
    {
      id: 'm4',
      status: 'revoked',
      accepted_at: null,
      profiles: { email: 'cancelled@farmacia.es' },
    },
  ];

  it('OWNER inviting new STAFF email → no match (permite invitar)', () => {
    assert.equal(
      findMembershipByEmailInPharmacy(rows, 'nuevo.empleado@correo.es'),
      null
    );
  });

  it('OWNER inviting existing STAFF email → invited match', () => {
    assert.deepEqual(
      findMembershipByEmailInPharmacy(rows, 'staff@farmacia.es'),
      { id: 'm2', status: 'invited', accepted_at: null }
    );
  });

  it('OWNER inviting existing PHARMACIST/active email → active match', () => {
    assert.deepEqual(
      findMembershipByEmailInPharmacy(rows, 'OWNER@farmacia.es'),
      {
        id: 'm1',
        status: 'active',
        accepted_at: '2024-01-01T00:00:00Z',
      }
    );
  });

  it('matches revoked former member (already_member path)', () => {
    assert.deepEqual(
      findMembershipByEmailInPharmacy(rows, 'old@farmacia.es'),
      {
        id: 'm3',
        status: 'revoked',
        accepted_at: '2024-06-01T00:00:00Z',
      }
    );
  });

  it('matches cancelled invitation (revoked + accepted_at null)', () => {
    assert.deepEqual(
      findMembershipByEmailInPharmacy(rows, 'cancelled@farmacia.es'),
      { id: 'm4', status: 'revoked', accepted_at: null }
    );
  });

  it('ignores blank email and missing profiles', () => {
    assert.equal(findMembershipByEmailInPharmacy(rows, ''), null);
    assert.equal(
      findMembershipByEmailInPharmacy(
        [{ id: 'x', status: 'active', profiles: null }],
        'a@b.com'
      ),
      null
    );
  });
});
