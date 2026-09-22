'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getCurrentProfile,
  hasPlatformSuperAdminRole,
  hasPlatformPermission,
} from '@/lib/auth/platform';
import type { PharmacyRoleKey } from '@/lib/pharmacies/types';

export type InvitePharmacyUserResult =
  | {
      ok: true;
      membershipId: string;
      /** true si se envió inviteUserByEmail; false si solo membership */
      invitationEmailSent: boolean;
    }
  | {
      ok: false;
      error: string;
      /**
       * Auth invite OK pero falló membership.
       * No se borra el usuario Auth; reintentar suele reconciliar.
       */
      code?: 'auth_ok_membership_failed' | 'already_member';
      existingStatus?: string;
    };

const ALLOWED_ROLE_KEYS: PharmacyRoleKey[] = [
  'PHARMACY_OWNER',
  'PHARMACY_ADMIN',
  'PHARMACIST',
  'STAFF',
];

const MEMBERSHIP_STATUS_MESSAGES: Record<string, string> = {
  invited:
    'Este email ya tiene una invitación pendiente en esta farmacia.',
  active: 'Este email ya es miembro activo de esta farmacia.',
  suspended:
    'Este email pertenece a un miembro suspendido de esta farmacia.',
  revoked:
    'Este email pertenece a un miembro con acceso revocado en esta farmacia.',
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** URL de app desde entorno (nunca desde el navegador). */
function getAppBaseUrl(): string | null {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim();

  if (process.env.NODE_ENV === 'production') {
    // Producción: obligatoria y no localhost.
    if (!configured) return null;
    if (/localhost|127\.0\.0\.1/i.test(configured)) return null;
    return configured.replace(/\/$/, '');
  }

  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:3000';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadProfileById(
  supabase: ReturnType<typeof createClient>,
  profileId: string
): Promise<{ id: string; email: string; full_name: string | null } | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('id', profileId)
      .maybeSingle();

    if (error) {
      console.error('[invite] profile by id', error.code, error.message);
      return null;
    }
    if (data) return data;
    await sleep(200);
  }
  return null;
}

async function insertMembership(params: {
  supabase: ReturnType<typeof createClient>;
  pharmacyId: string;
  profileId: string;
  roleId: string;
  actorId: string;
}): Promise<{ ok: true; membershipId: string } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  const { data, error } = await params.supabase
    .from('pharmacy_memberships')
    .insert({
      pharmacy_id: params.pharmacyId,
      profile_id: params.profileId,
      role_id: params.roleId,
      status: 'invited',
      invited_by: params.actorId,
      updated_by: params.actorId,
      invited_at: now,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[invite] membership insert', error.code, error.message);
    if (error.code === '42501') {
      return {
        ok: false,
        error: 'No tienes permiso para gestionar usuarios de farmacia.',
      };
    }
    if (error.code === '23505') {
      return {
        ok: false,
        error: 'Este usuario ya tiene una membresía en esta farmacia.',
      };
    }
    return {
      ok: false,
      error: 'No se ha podido registrar el acceso a la farmacia.',
    };
  }

  if (!data?.id) {
    return {
      ok: false,
      error: 'No se ha podido registrar el acceso a la farmacia.',
    };
  }

  return { ok: true, membershipId: data.id as string };
}

/**
 * Invita a un usuario a una farmacia.
 *
 * Autorización: sesión JWT + PLATFORM_SUPERADMIN + platform.users.write.
 * service_role: solo Auth Admin inviteUserByEmail.
 * Memberships/profiles/roles: cliente autenticado + RLS.
 *
 * Auth y PostgreSQL no comparten transacción. Si Auth OK y membership falla,
 * no se borra el usuario Auth; el reintento crea solo la membership.
 */
export async function invitePharmacyUserAction(input: {
  pharmacyId: string;
  fullName: string;
  email: string;
  roleKey: string;
}): Promise<InvitePharmacyUserResult> {
  const pharmacyId = input.pharmacyId?.trim() ?? '';
  const fullName = input.fullName?.trim() ?? '';
  const email = (input.email?.trim() ?? '').toLowerCase();
  const roleKey = input.roleKey?.trim() ?? '';

  if (!pharmacyId) {
    return { ok: false, error: 'Farmacia no válida.' };
  }
  if (!fullName) {
    return { ok: false, error: 'El nombre es obligatorio.' };
  }
  if (!email || !isValidEmail(email)) {
    return { ok: false, error: 'El email no es válido.' };
  }
  if (!ALLOWED_ROLE_KEYS.includes(roleKey as PharmacyRoleKey)) {
    return { ok: false, error: 'Selecciona un rol válido.' };
  }

  const {
    profile,
    authenticated,
    error: profileError,
  } = await getCurrentProfile();

  if (!authenticated || !profile) {
    return { ok: false, error: 'Debes iniciar sesión para invitar usuarios.' };
  }
  if (profileError) {
    return { ok: false, error: 'No se ha podido verificar tu sesión.' };
  }

  const superAdmin = await hasPlatformSuperAdminRole(profile.id);
  if (superAdmin.error) {
    return {
      ok: false,
      error: 'No se ha podido verificar tu rol de plataforma.',
    };
  }
  if (!superAdmin.ok) {
    return {
      ok: false,
      error: 'Solo un SuperAdministrador puede invitar usuarios.',
    };
  }

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

  const supabase = createClient();

  const { data: pharmacy, error: pharmacyError } = await supabase
    .from('pharmacies')
    .select('id')
    .eq('id', pharmacyId)
    .maybeSingle();

  if (pharmacyError || !pharmacy) {
    return { ok: false, error: 'No se ha encontrado la farmacia.' };
  }

  const { data: role, error: roleError } = await supabase
    .from('roles')
    .select('id, key')
    .eq('key', roleKey)
    .maybeSingle();

  if (roleError || !role) {
    return { ok: false, error: 'El rol seleccionado no existe.' };
  }

  // Usuario ya existente (email solo identifica; no autoriza).
  const { data: existingProfile, error: existingError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('email', email)
    .maybeSingle();

  if (existingError) {
    console.error('[invite] profile by email', existingError.message);
    return {
      ok: false,
      error: 'No se ha podido comprobar si el usuario ya existe.',
    };
  }

  if (existingProfile) {
    const { data: existingMembership, error: memLookupError } = await supabase
      .from('pharmacy_memberships')
      .select('id, status')
      .eq('pharmacy_id', pharmacyId)
      .eq('profile_id', existingProfile.id)
      .maybeSingle();

    if (memLookupError) {
      console.error('[invite] membership lookup', memLookupError.message);
      return {
        ok: false,
        error: 'No se ha podido comprobar la membresía existente.',
      };
    }

    if (existingMembership) {
      const status = existingMembership.status as string;
      return {
        ok: false,
        error:
          MEMBERSHIP_STATUS_MESSAGES[status] ??
          'Este email ya tiene acceso registrado en esta farmacia.',
        code: 'already_member',
        existingStatus: status,
      };
    }

    if (!existingProfile.full_name && fullName) {
      await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('id', existingProfile.id)
        .is('full_name', null);
    }

    const inserted = await insertMembership({
      supabase,
      pharmacyId,
      profileId: existingProfile.id,
      roleId: role.id as string,
      actorId: profile.id,
    });

    if (!inserted.ok) {
      return { ok: false, error: inserted.error };
    }

    revalidatePath(`/farmacias/${pharmacyId}`);
    return {
      ok: true,
      membershipId: inserted.membershipId,
      invitationEmailSent: false,
    };
  }

  // Usuario nuevo: Auth Admin
  const appBaseUrl = getAppBaseUrl();
  if (!appBaseUrl) {
    return {
      ok: false,
      error:
        'Falta una URL de aplicación válida (NEXT_PUBLIC_APP_URL). En producción no se permite localhost.',
    };
  }

  // PKCE (@supabase/ssr): el email debe aterrizar en /auth/callback?code=…
  // y de ahí a /first-access con cookies SSR ya establecidas.
  const redirectTo = `${appBaseUrl}/auth/callback?next=/first-access`;

  let invitedUserId: string;
  try {
    const admin = createAdminClient();
    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo,
      });

    if (inviteError) {
      const msg = inviteError.message.toLowerCase();
      if (
        msg.includes('already') ||
        msg.includes('registered') ||
        msg.includes('exists')
      ) {
        return {
          ok: false,
          error:
            'Este email ya está registrado en FarmaFácil. Si no aparece en la lista, espera un momento y vuelve a intentar la invitación para crear solo la membresía.',
        };
      }
      console.error('[invite] inviteUserByEmail', inviteError.message);
      return {
        ok: false,
        error: 'No se ha podido enviar la invitación por email.',
      };
    }

    if (!inviteData.user?.id) {
      return {
        ok: false,
        error: 'No se ha podido crear el usuario de invitación.',
      };
    }
    invitedUserId = inviteData.user.id;
  } catch (err) {
    console.error('[invite] admin client', err);
    return {
      ok: false,
      error:
        'No se ha podido completar la invitación (configuración Admin incompleta).',
    };
  }

  const newProfile = await loadProfileById(supabase, invitedUserId);
  if (!newProfile) {
    return {
      ok: false,
      error:
        'La invitación de acceso se ha enviado, pero no se ha podido localizar el perfil para registrar la farmacia. Reintenta la invitación en unos segundos; no se ha creado la membresía.',
      code: 'auth_ok_membership_failed',
    };
  }

  const inserted = await insertMembership({
    supabase,
    pharmacyId,
    profileId: newProfile.id,
    roleId: role.id as string,
    actorId: profile.id,
  });

  if (!inserted.ok) {
    return {
      ok: false,
      error: `${inserted.error} La invitación por email puede haberse enviado; reintenta para completar solo el acceso a la farmacia. No se ha borrado el usuario de Auth.`,
      code: 'auth_ok_membership_failed',
    };
  }

  revalidatePath(`/farmacias/${pharmacyId}`);
  return {
    ok: true,
    membershipId: inserted.membershipId,
    invitationEmailSent: true,
  };
}
