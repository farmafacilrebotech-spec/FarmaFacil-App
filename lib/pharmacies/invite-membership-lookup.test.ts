import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findMembershipByEmailInPharmacy } from './invite-membership-lookup.ts';

describe('findMembershipByEmailInPharmacy', () => {
  const rows = [
    {
      id: 'm1',
      status: 'active',
      profiles: { email: 'owner@farmacia.es' },
    },
    {
      id: 'm2',
      status: 'invited',
      profiles: [{ email: 'staff@farmacia.es' }],
    },
    {
      id: 'm3',
      status: 'revoked',
      profiles: { email: 'old@farmacia.es' },
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
      { id: 'm2', status: 'invited' }
    );
  });

  it('OWNER inviting existing PHARMACIST/active email → active match', () => {
    assert.deepEqual(
      findMembershipByEmailInPharmacy(rows, 'OWNER@farmacia.es'),
      { id: 'm1', status: 'active' }
    );
  });

  it('matches revoked membership (already_member path)', () => {
    assert.deepEqual(
      findMembershipByEmailInPharmacy(rows, 'old@farmacia.es'),
      { id: 'm3', status: 'revoked' }
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
