import { createClient } from '@/lib/supabase/server';
import {
  getCurrentProfile,
  hasPlatformPermission,
  hasPlatformSuperAdminRole,
} from '@/lib/auth/platform';
import { requireActivePharmacyMembership } from '@/lib/auth/access';
import type { PharmacyRoleKey } from '@/lib/pharmacies/types';
import {
  assignablePharmacyRoles,
  evaluateMembershipManagePermission,
  type MembershipActor,
  type MembershipManageAction,
} from '@/lib/pharmacies/membership-hierarchy';

export type MembershipManageAuth =
  | {
      ok: true;
      actor: MembershipActor;
      actorId: string;
      via: 'platform' | 'membership';
    }
  | { ok: false; error: string };

/**
 * Autoriza gestión de usuarios de farmacia:
 * - SuperAdmin + platform.users.write, o
 * - Membership active + memberships.manage (OWNER/ADMIN vía seed).
 *
 * Por defecto el camino tenant exige farmacia operable (como la RPC).
 * Para recuperación (reenvío / reset contraseña) pasar requireOperable: false
 * para no bloquear indebidamente el acceso mientras el soft-lock comercial actúa.
 *
 * La jerarquía de roles se aplica aparte con assertCanManageMembership.
 */
export async function requirePharmacyMembershipManage(
  pharmacyId: string,
  options?: { requireOperable?: boolean }
): Promise<MembershipManageAuth> {
  const requireOperable = options?.requireOperable !== false;

  if (!pharmacyId || !/^[0-9a-f-]{36}$/i.test(pharmacyId)) {
    return { ok: false, error: 'Farmacia no válida.' };
  }

  const { profile, authenticated, error } = await getCurrentProfile();
  if (!authenticated || !profile) {
    return { ok: false, error: 'Debes iniciar sesión.' };
  }
  if (error) {
    return { ok: false, error: 'No se ha podido verificar tu sesión.' };
  }

  const superAdmin = await hasPlatformSuperAdminRole(profile.id);
  if (superAdmin.error) {
    return {
      ok: false,
      error: 'No se ha podido verificar tu rol de plataforma.',
    };
  }

  if (superAdmin.ok) {
    const canWrite = await hasPlatformPermission('platform.users.write');
    if (canWrite.error) {
      return {
        ok: false,
        error: 'No se ha podido verificar tu permiso de usuarios.',
      };
    }
    if (!canWrite.ok) {
      return {
        ok: false,
        error: 'No tienes permiso para gestionar usuarios de farmacia.',
      };
    }
    return {
      ok: true,
      actor: { kind: 'platform', profileId: profile.id },
      actorId: profile.id,
      via: 'platform',
    };
  }

  const membership = await requireActivePharmacyMembership(pharmacyId);
  if (!membership.ok) {
    return {
      ok: false,
      error: 'No tienes acceso activo a esta farmacia.',
    };
  }

  const supabase = createClient();
  const { data: canManage, error: permError } = await supabase.rpc(
    'ff_has_pharmacy_permission',
    {
      p_pharmacy_id: pharmacyId,
      p_permission_key: 'memberships.manage',
    }
  );

  if (permError) {
    console.error('[membership-authz] permission', permError.message);
    return {
      ok: false,
      error: 'No se ha podido verificar el permiso de usuarios.',
    };
  }

  if (canManage !== true) {
    return {
      ok: false,
      error:
        'Solo el propietario o administrador puede gestionar usuarios de esta farmacia.',
    };
  }

  const roleKey = membership.membership.roleKey as PharmacyRoleKey;
  if (roleKey !== 'PHARMACY_OWNER' && roleKey !== 'PHARMACY_ADMIN') {
    return {
      ok: false,
      error:
        'Solo el propietario o administrador puede gestionar usuarios de esta farmacia.',
    };
  }

  // Tenant: farmacia operable (misma regla que la RPC), salvo recuperación.
  if (requireOperable) {
    const { data: operable, error: operableError } = await supabase.rpc(
      'ff_pharmacy_is_operable',
      { p_pharmacy_id: pharmacyId }
    );
    if (operableError) {
      console.error('[membership-authz] operable', operableError.message);
      return {
        ok: false,
        error: 'No se ha podido verificar el acceso comercial de la farmacia.',
      };
    }
    if (operable !== true) {
      return {
        ok: false,
        error:
          'No se pueden gestionar usuarios mientras la farmacia no tiene acceso comercial vigente.',
      };
    }
  }

  return {
    ok: true,
    actor: {
      kind: 'tenant',
      roleKey,
      profileId: profile.id,
    },
    actorId: profile.id,
    via: 'membership',
  };
}

export function assertCanManageMembership(input: {
  actor: MembershipActor;
  targetProfileId: string;
  targetRoleKey: PharmacyRoleKey;
  action: MembershipManageAction;
  newRoleKey?: PharmacyRoleKey;
}): { ok: true } | { ok: false; error: string } {
  const result = evaluateMembershipManagePermission(input);
  if (!result.ok) {
    return { ok: false, error: result.reason };
  }
  return { ok: true };
}

export function filterAssignableRoles<T extends { key: string }>(
  actor: MembershipActor,
  roles: T[]
): T[] {
  const allowed = new Set(assignablePharmacyRoles(actor));
  return roles.filter((r) => allowed.has(r.key as PharmacyRoleKey));
}
