import type {
  PharmacyMember,
  PharmacyRoleKey,
  PharmacyRoleOption,
} from '@/lib/pharmacies/types';
import {
  assignablePharmacyRoles,
  canManageTargetRole,
  evaluateMembershipManagePermission,
  type MembershipActor,
} from '@/lib/pharmacies/membership-hierarchy';

export type PharmacyUsersCapabilities = {
  actor: MembershipActor;
  canInvite: boolean;
  assignableRoles: PharmacyRoleOption[];
};

export function buildPharmacyUsersCapabilities(input: {
  actor: MembershipActor;
  roles: PharmacyRoleOption[];
}): PharmacyUsersCapabilities {
  const assignableKeys = new Set(assignablePharmacyRoles(input.actor));
  const assignableRoles = input.roles.filter((r) =>
    assignableKeys.has(r.key as PharmacyRoleKey)
  );
  return {
    actor: input.actor,
    canInvite: assignableRoles.length > 0,
    assignableRoles,
  };
}

/**
 * Muestra menú si puede gestionar el rol ajeno, o si es su propia fila
 * (edición / recuperación sin cambio de rol).
 */
export function canShowMemberActions(
  actor: MembershipActor,
  member: PharmacyMember
): boolean {
  if (canManageTargetRole(actor, member.role.key as PharmacyRoleKey)) {
    return true;
  }
  const selfEdit = evaluateMembershipManagePermission({
    actor,
    targetProfileId: member.profile.id,
    targetRoleKey: member.role.key as PharmacyRoleKey,
    action: 'edit',
    newRoleKey: member.role.key as PharmacyRoleKey,
  });
  return selfEdit.ok;
}

export function canShowDestructiveAction(
  actor: MembershipActor,
  member: PharmacyMember,
  action: 'suspend' | 'revoke' | 'cancel_invitation'
): boolean {
  const result = evaluateMembershipManagePermission({
    actor,
    targetProfileId: member.profile.id,
    targetRoleKey: member.role.key as PharmacyRoleKey,
    action,
  });
  return result.ok;
}

/**
 * Roles del diálogo de edición: en auto-edición tenant solo el rol actual
 * (no se puede cambiar el propio rol en flujo ordinario).
 */
export function rolesForMemberEdit(
  actor: MembershipActor,
  member: PharmacyMember,
  assignableRoles: PharmacyRoleOption[]
): PharmacyRoleOption[] {
  if (actor.kind === 'platform') {
    return assignableRoles;
  }
  if (actor.profileId === member.profile.id) {
    return [
      {
        id: `current-${member.role.key}`,
        key: member.role.key as PharmacyRoleKey,
        name: member.role.name,
      },
    ];
  }
  return assignableRoles;
}
