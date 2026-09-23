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
 * Carga memberships active del usuario autenticado.
 * Autorización: RLS (profile_id = auth.uid() u otras reglas de 012).
 * No usa last_pharmacy_id ni pharmacy_id del cliente como autorización.
 */
async function listActiveMemberships(
  profileId: string
): Promise<{ memberships: PharmacyMembershipSummary[]; error?: string }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('pharmacy_memberships')
    .select(
      `
      id,
      pharmacy_id,
      roles!inner (
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
 * Nunca usa pharmacy_id del cliente ni last_pharmacy_id como autorización.
 */
export function destinationForAppAccess(access: AppAccessResult): string {
  switch (access.status) {
    case 'unauthenticated':
      return '/login';
    case 'platform':
      return '/dashboard';
    case 'pharmacy':
      return `/f/${access.membership.pharmacyId}/dashboard`;
    case 'multiple_pharmacies':
      return '/auth/select-pharmacy';
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

  // platform / invited / forbidden → no acceso tenant por membership
  return { ok: false, reason: 'forbidden' };
}

/**
 * Acceso a catálogo de una farmacia:
 * - membership active de esa farmacia, o
 * - permiso platform.pharmacies.read (lectura) / platform.pharmacies.write (escritura).
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
  const membership = await requireActivePharmacyMembership(pharmacyId);
  if (membership.ok) {
    return {
      ok: true,
      profile: membership.profile,
      via: 'membership',
    };
  }

  if (membership.reason === 'unauthenticated' || membership.reason === 'error') {
    return membership;
  }

  if (mode === 'write') {
    const write = await hasPlatformPermission('platform.pharmacies.write');
    if (!write.ok) {
      return { ok: false, reason: 'forbidden' };
    }
  } else {
    const write = await hasPlatformPermission('platform.pharmacies.write');
    if (!write.ok) {
      const read = await hasPlatformPermission('platform.pharmacies.read');
      if (!read.ok) {
        return { ok: false, reason: 'forbidden' };
      }
    }
  }

  const { profile, authenticated, error } = await getCurrentProfile();
  if (!authenticated) {
    return { ok: false, reason: 'unauthenticated' };
  }
  if (error || !profile) {
    return { ok: false, reason: 'error', message: error };
  }

  return { ok: true, profile, via: 'platform' };
}

