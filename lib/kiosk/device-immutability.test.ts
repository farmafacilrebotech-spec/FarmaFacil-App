/**
 * npm run test:kiosk-pairing
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canReassignDevicePharmacy } from './device-immutability.ts';

const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('device pharmacy_id immutability', () => {
  it('blocks silent reassignment', () => {
    const result = canReassignDevicePharmacy({
      oldPharmacyId: A,
      newPharmacyId: B,
      adminUnlinkAndRepairOperation: false,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'pharmacy_id_immutable');
  });

  it('same pharmacy id is a no-op update', () => {
    assert.equal(
      canReassignDevicePharmacy({
        oldPharmacyId: A,
        newPharmacyId: A,
        adminUnlinkAndRepairOperation: false,
      }).allowed,
      true
    );
  });

  it('does not allow silent reassign even under admin flag (fase 1: revoke+repair)', () => {
    const result = canReassignDevicePharmacy({
      oldPharmacyId: A,
      newPharmacyId: B,
      adminUnlinkAndRepairOperation: true,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'use_revoke_and_repair');
  });
});
