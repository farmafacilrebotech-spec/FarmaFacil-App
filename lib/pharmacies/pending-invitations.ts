/**
 * Contrato de listado de invitaciones pending (espejo RPC 033).
 * Puro: sin I/O; usable en tests de regresión.
 */

export type PendingPharmacyInvitation = {
  membershipId: string;
  pharmacyId: string;
  pharmacyName: string;
  roleKey: string;
  roleName: string;
  invitedAt: string | null;
};

/** Fila cruda que puede devolver PostgREST / ff_list_pending_pharmacy_invitations_v1. */
export type PendingInvitationRpcRow = {
  membership_id?: unknown;
  pharmacy_id?: unknown;
  pharmacy_name?: unknown;
  role_key?: unknown;
  role_name?: unknown;
  invited_at?: unknown;
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asUuid(value: unknown): string | null {
  const s = asNonEmptyString(value);
  if (!s || !/^[0-9a-f-]{36}$/i.test(s)) return null;
  return s;
}

function asIsoOrNull(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  return value;
}

/**
 * Mapea filas RPC → DTO de app. Descarta filas incompletas.
 * La RPC ya filtra por auth.uid() + status=invited; aquí solo normalizamos.
 */
export function mapPendingInvitationRpcRows(
  rows: PendingInvitationRpcRow[] | null | undefined
): PendingPharmacyInvitation[] {
  const out: PendingPharmacyInvitation[] = [];
  for (const row of rows ?? []) {
    const membershipId = asUuid(row.membership_id);
    const pharmacyId = asUuid(row.pharmacy_id);
    const pharmacyName = asNonEmptyString(row.pharmacy_name);
    const roleKey = asNonEmptyString(row.role_key);
    const roleName = asNonEmptyString(row.role_name);
    if (!membershipId || !pharmacyId || !pharmacyName || !roleKey || !roleName) {
      continue;
    }
    out.push({
      membershipId,
      pharmacyId,
      pharmacyName,
      roleKey,
      roleName,
      invitedAt: asIsoOrNull(row.invited_at),
    });
  }
  return out;
}

/**
 * Resolución mínima de acceso (espejo del tramo post-SuperAdmin de resolveAppAccess)
 * para regresión invited / active / ajeno / sin invitación — sin I/O.
 */
export type PendingAccessBranch =
  | 'pharmacy'
  | 'multiple_pharmacies'
  | 'invited'
  | 'forbidden';

export function resolvePendingAccessBranch(input: {
  activeMembershipCount: number;
  pendingInvitationCount: number;
}): PendingAccessBranch {
  if (input.activeMembershipCount === 1) return 'pharmacy';
  if (input.activeMembershipCount > 1) return 'multiple_pharmacies';
  if (input.pendingInvitationCount > 0) return 'invited';
  return 'forbidden';
}

/**
 * Invited no debe tratarse como member operativo (catálogo/pedidos).
 * activeMembershipCount === 0 aunque haya pending.
 */
export function invitedAllowsOperationalTenantAccess(
  membershipStatus: 'invited' | 'active' | 'suspended' | 'revoked'
): boolean {
  return membershipStatus === 'active';
}
