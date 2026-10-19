import { createClient } from '@/lib/supabase/server';
import {
  getCurrentProfile,
  hasPlatformPermission,
  hasPlatformSuperAdminRole,
  type CurrentProfile,
} from '@/lib/auth/platform';
import {
  hasCurrentLegalAcceptance,
  listPendingPharmacyInvitations,
  type PendingPharmacyInvitation,
} from '@/lib/pharmacies/invitations';
import { loadPharmacyCommercialGate } from '@/lib/pharmacies/commercial-access';
import {
  pathForTenantRouteDecision,
  resolveLostPharmacyAccessRedirect,
  resolveTenantRouteDecision,
} from '@/lib/pharmacies/pharmacy-access-routing';

export type { CurrentProfile, PendingPharmacyInvitation };

export type PharmacyRoleKey =
  | 'PHARMACY_OWNER'
  | 'PHARMACY_ADMIN'
  | 'PHARMACIST'
  | 'STAFF'
  | string;

export type PharmacyMembershipSummary = {
  membershipId: string;
  pharmacyId: string;
  roleKey: PharmacyRoleKey;
  roleName: string;
};

export type AppAccessResult =
  | { status: 'unauthenticated' }
  | { status: 'platform'; profile: CurrentProfile }
  | {
      status: 'pharmacy';
      profile: CurrentProfile;
      membership: PharmacyMembershipSummary;
      pendingInvitations: PendingPharmacyInvitation[];
    }
  | {
      status: 'multiple_pharmacies';
      profile: CurrentProfile;
      memberships: PharmacyMembershipSummary[];
      pendingInvitations: PendingPharmacyInvitation[];
    }
  | {
      /** Sesión válida con membership invited y ninguna active. */
      status: 'invited';
      profile: CurrentProfile;
      pendingInvitations: PendingPharmacyInvitation[];
      /** true = alta incompleta (first-access); false = usuario FarmaFácil establecido */
      needsFirstAccess: boolean;
    }
  | { status: 'forbidden'; profile: CurrentProfile }
  | { status: 'error'; message: string; email?: string };

type MembershipRow = {
  id: string;
  pharmacy_id: string;
  status?: string;
  roles:
    | { key: string; name: string }
    | { key: string; name: string }[]
    | null;
};

function mapMembership(row: MembershipRow): PharmacyMembershipSummary | null {
  const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
  if (!role?.key) {
    return null;
  }

  return {
    membershipId: row.id,
    pharmacyId: row.pharmacy_id,
    roleKey: role.key,
    roleName: role.name,
  };
}

/**
 * Carga TODAS las memberships active del usuario (cualquier rol de farmacia).
 * Autorización: RLS (profile_id = auth.uid()).
 * No usa last_pharmacy_id ni pharmacy_id del cliente como autorización.
 * invited / suspended / revoked quedan fuera por el filtro status=active.
 */
export async function listActiveMemberships(
  profileId: string
): Promise<{ memberships: PharmacyMembershipSummary[]; error?: string }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('pharmacy_memberships')
    .select(
      `
      id,
      pharmacy_id,
      roles!pharmacy_memberships_role_id_fkey!inner (
        key,
        name
      )
    `
    )
    .eq('profile_id', profileId)
    .eq('status', 'active');

  if (error) {
    console.error('active memberships load failed:', error.code, error.message);
    return { memberships: [], error: error.message };
  }

  const memberships = (data as MembershipRow[] | null ?? [])
    .map(mapMembership)
    .filter((m): m is PharmacyMembershipSummary => m != null);

  return { memberships };
}

/**
 * Resolución de acceso de aplicación (plataforma vs tenant).
 * Independiente de resolvePlatformAccess: no altera el gate SuperAdmin existente.
 *
 * Orden:
 * 1) sin sesión
 * 2) PLATFORM_SUPERADMIN → platform
 * 3) 1 membership active (+ pending invitations opcionales) → pharmacy
 * 4) >1 memberships active (+ pending invitations opcionales) → multiple_pharmacies
 * 5) solo invited → invited (needsFirstAccess según legal vigente)
 * 6) ninguna → forbidden
 */
export async function resolveAppAccess(): Promise<AppAccessResult> {
  const { profile, authenticated, error } = await getCurrentProfile();

  if (!authenticated) {
    return { status: 'unauthenticated' };
  }

  if (error || !profile) {
    return {
      status: 'error',
      message: error ?? 'No se ha podido cargar el perfil.',
      email: profile?.email,
    };
  }

  const platformRole = await hasPlatformSuperAdminRole(profile.id);

  if (platformRole.error) {
    return {
      status: 'error',
      message: platformRole.error,
      email: profile.email,
    };
  }

  if (platformRole.ok) {
    return { status: 'platform', profile };
  }

  const { memberships, error: membershipError } = await listActiveMemberships(
    profile.id
  );

  if (membershipError) {
    return {
      status: 'error',
      message: membershipError,
      email: profile.email,
    };
  }

  const { invitations: pendingInvitations } =
    await listPendingPharmacyInvitations(profile.id);

  if (memberships.length === 1) {
    return {
      status: 'pharmacy',
      profile,
      membership: memberships[0],
      pendingInvitations,
    };
  }

  if (memberships.length > 1) {
    return {
      status: 'multiple_pharmacies',
      profile,
      memberships,
      pendingInvitations,
    };
  }

  if (pendingInvitations.length > 0) {
    // Usuario establecido (legal vigente) → aceptar invitaciones sin first-access.
    const hasLegal = await hasCurrentLegalAcceptance(profile.id);
    return {
      status: 'invited',
      profile,
      pendingInvitations,
      needsFirstAccess: !hasLegal,
    };
  }

  return { status: 'forbidden', profile };
}

/**
 * Destino interno tras autenticación (login, continue, post first-access).
 * ≥2 memberships active → SIEMPRE selector (last_pharmacy_id no salta el paso).
 * SuperAdmin (platform) → panel plataforma; acceso miembro sigue en /f/….
 */
export function destinationForAppAccess(access: AppAccessResult): string {
  switch (access.status) {
    case 'unauthenticated':
      return '/login';
    case 'platform':
      return '/dashboard';
    case 'pharmacy':
      return `/f/${access.membership.pharmacyId}/dashboard`;
    case 'multiple_pharmacies': {
      const decision = resolveTenantRouteDecision({
        activeMemberships: access.memberships.map((m) => ({
          pharmacyId: m.pharmacyId,
          roleKey: m.roleKey,
          roleName: m.roleName,
          membershipId: m.membershipId,
        })),
      });
      return (
        pathForTenantRouteDecision(decision) ?? '/auth/select-pharmacy'
      );
    }
    case 'invited':
      return access.needsFirstAccess ? '/first-access' : '/auth/invitations';
    case 'forbidden':
      return '/access-denied';
    case 'error':
      return '/access-denied';
    default:
      return '/login';
  }
}

/**
 * Comprueba membership active del usuario actual para una farmacia concreta.
 * Usado por el layout tenant. Sin confiar en el pharmacyId más allá de filtrar
 * contra memberships ya autorizadas por RLS + auth.uid().
 */
export async function requireActivePharmacyMembership(pharmacyId: string): Promise<
  | {
      ok: true;
      profile: CurrentProfile;
      membership: PharmacyMembershipSummary;
    }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' | 'error'; message?: string }
> {
  if (!pharmacyId || !/^[0-9a-f-]{36}$/i.test(pharmacyId)) {
    return { ok: false, reason: 'forbidden' };
  }

  const access = await resolveAppAccess();

  if (access.status === 'unauthenticated') {
    return { ok: false, reason: 'unauthenticated' };
  }

  if (access.status === 'error') {
    return { ok: false, reason: 'error', message: access.message };
  }

  if (access.status === 'pharmacy') {
    if (access.membership.pharmacyId !== pharmacyId) {
      return { ok: false, reason: 'forbidden' };
    }
    return {
      ok: true,
      profile: access.profile,
      membership: access.membership,
    };
  }

  if (access.status === 'multiple_pharmacies') {
    const membership = access.memberships.find(
      (m) => m.pharmacyId === pharmacyId
    );
    if (!membership) {
      return { ok: false, reason: 'forbidden' };
    }
    return {
      ok: true,
      profile: access.profile,
      membership,
    };
  }

  // SuperAdmin de plataforma puede además ser miembro de farmacias:
  // el panel /dashboard queda separado; /f/:id exige membership active.
  if (access.status === 'platform') {
    const { memberships, error: memError } = await listActiveMemberships(
      access.profile.id
    );
    if (memError) {
      return { ok: false, reason: 'error', message: memError };
    }
    const membership = memberships.find((m) => m.pharmacyId === pharmacyId);
    if (!membership) {
      return { ok: false, reason: 'forbidden' };
    }
    return {
      ok: true,
      profile: access.profile,
      membership,
    };
  }

  // invited / forbidden → no acceso tenant operativo
  return { ok: false, reason: 'forbidden' };
}

/**
 * Redirección cuando la URL apunta a una farmacia sin membership active.
 * Valida en servidor las memberships active restantes.
 */
export async function redirectPathAfterLostPharmacyAccess(
  failedPharmacyId: string
): Promise<string> {
  const access = await resolveAppAccess();

  if (access.status === 'pharmacy') {
    return `/f/${access.membership.pharmacyId}/dashboard`;
  }

  if (access.status === 'multiple_pharmacies') {
    return resolveLostPharmacyAccessRedirect({
      failedPharmacyId,
      activeMemberships: access.memberships.map((m) => ({
        pharmacyId: m.pharmacyId,
        roleKey: m.roleKey,
        roleName: m.roleName,
        membershipId: m.membershipId,
      })),
    });
  }

  if (access.status === 'platform') {
    const { memberships } = await listActiveMemberships(access.profile.id);
    if (memberships.length > 0) {
      return resolveLostPharmacyAccessRedirect({
        failedPharmacyId,
        activeMemberships: memberships.map((m) => ({
          pharmacyId: m.pharmacyId,
          roleKey: m.roleKey,
          roleName: m.roleName,
          membershipId: m.membershipId,
        })),
      });
    }
    return '/dashboard';
  }

  return destinationForAppAccess(access);
}

/**
 * Acceso a catálogo de una farmacia:
 * - permiso platform (prioridad; SuperAdmin no queda bloqueado por operatividad), o
 * - membership active + farmacia comercialmente operable.
 * No debilita RLS: la BD sigue filtrando por ff_can_read_pharmacy / membership|platform write.
 */
export async function requirePharmacyCatalogAccess(
  pharmacyId: string,
  mode: 'read' | 'write' = 'read'
): Promise<
  | {
      ok: true;
      profile: CurrentProfile;
      via: 'membership' | 'platform';
    }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' | 'error'; message?: string }
> {
  const { profile, authenticated, error } = await getCurrentProfile();
  if (!authenticated) {
    return { ok: false, reason: 'unauthenticated' };
  }
  if (error || !profile) {
    return { ok: false, reason: 'error', message: error };
  }

  // Plataforma primero: gestión SuperAdmin aunque también sea member.
  const write = await hasPlatformPermission('platform.pharmacies.write');
  if (write.ok) {
    return { ok: true, profile, via: 'platform' };
  }
  if (mode === 'read') {
    const read = await hasPlatformPermission('platform.pharmacies.read');
    if (read.ok) {
      return { ok: true, profile, via: 'platform' };
    }
  }

  const membership = await requireActivePharmacyMembership(pharmacyId);
  if (!membership.ok) {
    return membership;
  }

  // Tenant: bloquear catálogo si la farmacia no es operable (defensa frente a server actions).
  const commercial = await loadPharmacyCommercialGate(pharmacyId);
  if (!commercial.ok || !commercial.gate.operable) {
    return { ok: false, reason: 'forbidden' };
  }

  return {
    ok: true,
    profile: membership.profile,
    via: 'membership',
  };
}

