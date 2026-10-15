/**
 * Regla de dominio: pharmacy_id del dispositivo es inmutable tras el alta.
 * Espejo del trigger ff_pharmacy_devices_forbid_pharmacy_reassign.
 */

export function canReassignDevicePharmacy(input: {
  oldPharmacyId: string;
  newPharmacyId: string;
  adminUnlinkAndRepairOperation: boolean;
}): { allowed: boolean; reason?: string } {
  if (input.oldPharmacyId === input.newPharmacyId) {
    return { allowed: true };
  }
  // Fase 1: no hay operación admin de reasignación silenciosa.
  // Desvinculación = revoke + nuevo emparejamiento (nuevo device_id).
  if (input.adminUnlinkAndRepairOperation) {
    return {
      allowed: false,
      reason: 'use_revoke_and_repair',
    };
  }
  return { allowed: false, reason: 'pharmacy_id_immutable' };
}
