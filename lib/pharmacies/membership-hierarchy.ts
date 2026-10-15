/**
 * Jerarquía de roles de farmacia — reglas de dominio testeables sin BD.
 *
 * - OWNER: invita/gestiona ADMIN, PHARMACIST y STAFF. No crea ni gestiona
 *   otros OWNER en el flujo ordinario (titulares = SuperAdmin).
 * - ADMIN: solo PHARMACIST y STAFF.
 * - PLATFORM_SUPERADMIN: gestiona titulares y todos los roles.
 * - Nadie puede suspender/revocar/cancelar su propia membership.
 * - Edición/recuperación sobre uno mismo: nombre/email/reset/reenvío sin
 *   cambio de rol (el cambio de rol propio queda para plataforma).
 */

import type { PharmacyRoleKey } from '@/lib/pharmacies/types';

export const PHARMACY_MANAGEABLE_ROLE_KEYS: PharmacyRoleKey[] = [
  'PHARMACY_OWNER',
  'PHARMACY_ADMIN',
  'PHARMACIST',
  'STAFF',
];

/** Roles que un OWNER de farmacia puede asignar / gestionar (flujo ordinario). */
export const OWNER_ORDINARY_ROLE_KEYS: PharmacyRoleKey[] = [
  'PHARMACY_ADMIN',
  'PHARMACIST',
  'STAFF',
];

export type MembershipActor =
  | { kind: 'platform'; profileId: string }
  | { kind: 'tenant'; roleKey: PharmacyRoleKey; profileId: string };

export type MembershipManageAction =
  | 'suspend'
  | 'revoke'
  | 'cancel_invitation'
  | 'reactivate'
  | 'reinvite'
  | 'edit'
  | 'invite'
  | 'resend'
  | 'password_reset';

const SELF_BLOCKED_ACTIONS: MembershipManageAction[] = [
  'suspend',
  'revoke',
  'cancel_invitation',
];

const SELF_ALLOWED_WITHOUT_ROLE_CHANGE: MembershipManageAction[] = [
  'edit',
  'password_reset',
  'resend',
];

/** Roles que el actor puede asignar al invitar / editar. */
export function assignablePharmacyRoles(
  actor: MembershipActor
): PharmacyRoleKey[] {
  if (actor.kind === 'platform') {
    return [...PHARMACY_MANAGEABLE_ROLE_KEYS];
  }
  if (actor.roleKey === 'PHARMACY_OWNER') {
    return [...OWNER_ORDINARY_ROLE_KEYS];
  }
  if (actor.roleKey === 'PHARMACY_ADMIN') {
    return ['PHARMACIST', 'STAFF'];
  }
  return [];
}

/**
 * ¿Puede el actor gestionar una membership cuyo rol actual es `targetRoleKey`?
 * No incluye auto-edición / recuperación (ver evaluateMembershipManagePermission).
 */
export function canManageTargetRole(
  actor: MembershipActor,
  targetRoleKey: PharmacyRoleKey
): boolean {
  if (actor.kind === 'platform') return true;
  if (actor.roleKey === 'PHARMACY_OWNER') {
    return OWNER_ORDINARY_ROLE_KEYS.includes(targetRoleKey);
  }
  if (actor.roleKey === 'PHARMACY_ADMIN') {
    return targetRoleKey === 'PHARMACIST' || targetRoleKey === 'STAFF';
  }
  return false;
}

/** ¿Puede asignar el rol `newRoleKey`? */
export function canAssignRole(
  actor: MembershipActor,
  newRoleKey: PharmacyRoleKey
): boolean {
  return assignablePharmacyRoles(actor).includes(newRoleKey);
}

export function isSelfMembershipAction(input: {
  actorProfileId: string;
  targetProfileId: string;
}): boolean {
  return (
    !!input.actorProfileId &&
    !!input.targetProfileId &&
    input.actorProfileId === input.targetProfileId
  );
}

/**
 * Regla completa para una acción sobre una membership existente
 * (o targetRole al invitar/asignar).
 */
export function evaluateMembershipManagePermission(input: {
  actor: MembershipActor;
  targetProfileId: string;
  targetRoleKey: PharmacyRoleKey;
  action: MembershipManageAction;
  /** Rol que se quiere asignar (invite/edit). */
  newRoleKey?: PharmacyRoleKey;
}): { ok: true } | { ok: false; reason: string } {
  const { actor, targetProfileId, targetRoleKey, action, newRoleKey } = input;

  const isSelf = isSelfMembershipAction({
    actorProfileId: actor.profileId,
    targetProfileId,
  });

  if (SELF_BLOCKED_ACTIONS.includes(action) && isSelf) {
    return {
      ok: false,
      reason: 'No puedes suspender, revocar ni cancelar tu propio acceso.',
    };
  }

  // Auto-edición / recuperación: sin cambio de rol (titulares solo vía plataforma).
  if (isSelf && SELF_ALLOWED_WITHOUT_ROLE_CHANGE.includes(action)) {
    if (
      action === 'edit' &&
      newRoleKey &&
      newRoleKey !== targetRoleKey &&
      actor.kind !== 'platform'
    ) {
      return {
        ok: false,
        reason:
          'No puedes cambiar tu propio rol. La gestión de titulares la realiza FarmaFácil (SuperAdministrador).',
      };
    }
    if (actor.kind === 'platform') {
      if (
        newRoleKey &&
        action === 'edit' &&
        !canAssignRole(actor, newRoleKey)
      ) {
        return {
          ok: false,
          reason: 'No puedes asignar ese rol con tu nivel de acceso.',
        };
      }
      return { ok: true };
    }
    // Tenant: nombre/email/reset/reenvío sobre uno mismo.
    return { ok: true };
  }

  if (!canManageTargetRole(actor, targetRoleKey)) {
    return {
      ok: false,
      reason:
        actor.kind === 'tenant' && targetRoleKey === 'PHARMACY_OWNER'
          ? 'Los titulares (propietarios) solo los gestiona FarmaFácil (SuperAdministrador).'
          : 'No tienes permiso para gestionar usuarios con este rol en la farmacia.',
    };
  }

  if (
    newRoleKey &&
    (action === 'edit' || action === 'invite' || action === 'reinvite') &&
    !canAssignRole(actor, newRoleKey)
  ) {
    return {
      ok: false,
      reason:
        newRoleKey === 'PHARMACY_OWNER' && actor.kind !== 'platform'
          ? 'Solo FarmaFácil (SuperAdministrador) puede asignar el rol de propietario.'
          : 'No puedes asignar ese rol con tu nivel de acceso.',
    };
  }

  return { ok: true };
}
