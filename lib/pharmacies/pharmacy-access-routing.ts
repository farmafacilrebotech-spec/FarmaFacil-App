/**
 * Enrutado tenant multi-farmacia (puro; testeable).
 * Solo memberships active cuentan como acceso. invited/suspended/revoked no.
 * lastPharmacyId es preferencia visual: nunca autoriza ni salta el selector al login.
 */

export type ActivePharmacyAccess = {
  pharmacyId: string;
  roleKey: string;
  roleName: string;
  membershipId: string;
};

export type TenantRouteDecision =
  | { kind: 'none' }
  | { kind: 'single'; pharmacyId: string }
  | { kind: 'select' };

/**
 * Decide destino tras login / continue según memberships active.
 * - 0 → none
 * - 1 → single (entra directo al dashboard)
 * - ≥2 → select SIEMPRE (aunque exista lastPharmacyId)
 */
export function resolveTenantRouteDecision(input: {
  activeMemberships: readonly ActivePharmacyAccess[];
}): TenantRouteDecision {
  const active = input.activeMemberships;
  if (active.length === 0) return { kind: 'none' };
  if (active.length === 1) {
    return { kind: 'single', pharmacyId: active[0].pharmacyId };
  }
  return { kind: 'select' };
}

export function pathForTenantRouteDecision(
  decision: TenantRouteDecision
): string | null {
  switch (decision.kind) {
    case 'none':
      return null;
    case 'single':
      return `/f/${decision.pharmacyId}/dashboard`;
    case 'select':
      return '/auth/select-pharmacy';
    default:
      return null;
  }
}

/**
 * last_pharmacy_id solo para destacar en el selector si sigue siendo active.
 */
export function isHighlightedLastPharmacy(input: {
  pharmacyId: string;
  lastPharmacyId?: string | null;
  activePharmacyIds: readonly string[];
}): boolean {
  const last = input.lastPharmacyId?.trim() || '';
  if (!last || last !== input.pharmacyId) return false;
  return input.activePharmacyIds.includes(last);
}

/**
 * Si la farmacia de la URL ya no es accesible, elige otra active o el selector.
 */
export function resolveLostPharmacyAccessRedirect(input: {
  failedPharmacyId: string;
  activeMemberships: readonly ActivePharmacyAccess[];
}): string {
  const others = input.activeMemberships.filter(
    (m) => m.pharmacyId !== input.failedPharmacyId
  );
  if (others.length === 1) {
    return `/f/${others[0].pharmacyId}/dashboard`;
  }
  if (others.length > 1) {
    return '/auth/select-pharmacy';
  }
  return '/access-denied';
}

/** Solo status active es acceso operativo. */
export function isOperationalMembershipStatus(status: string): boolean {
  return status === 'active';
}
