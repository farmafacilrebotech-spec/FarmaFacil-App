import { createClient } from '@/lib/supabase/server';
import {
  getCurrentProfile,
  hasPlatformSuperAdminRole,
  type CurrentProfile,
} from '@/lib/auth/platform';

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
    }
  | {
      status: 'multiple_pharmacies';
      profile: CurrentProfile;
      memberships: PharmacyMembershipSummary[];
    }
  | { status: 'forbidden'; profile: CurrentProfile }
  | { status: 'error'; message: string; email?: string };

type MembershipRow = {
  id: string;
  pharmacy_id: string;
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
 * No usa last_pharmacy_id ni pharmacy_id del cliente.
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
 * 3) 1 membership active → pharmacy
 * 4) >1 memberships active → multiple_pharmacies
 * 5) ninguna → forbidden
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

  if (memberships.length === 1) {
    return {
      status: 'pharmacy',
      profile,
      membership: memberships[0],
    };
  }

  if (memberships.length > 1) {
    return {
      status: 'multiple_pharmacies',
      profile,
      memberships,
    };
  }

  return { status: 'forbidden', profile };
}
