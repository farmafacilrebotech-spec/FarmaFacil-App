/**
 * Autorización para gestionar el logo de farmacia.
 * SuperAdmin (platform.pharmacies.write) o branding.update (Owner/Admin).
 */

import { createClient } from '@/lib/supabase/server';
import {
  getCurrentProfile,
  hasPlatformPermission,
  type CurrentProfile,
} from '@/lib/auth/platform';
import { requireActivePharmacyMembership } from '@/lib/auth/access';

export type PharmacyLogoAuthzResult =
  | {
      ok: true;
      profile: CurrentProfile;
      via: 'platform' | 'membership';
      actorId: string;
    }
  | { ok: false; error: string };

export async function requirePharmacyLogoManageAccess(
  pharmacyId: string
): Promise<PharmacyLogoAuthzResult> {
  const id = pharmacyId?.trim();
  if (!id) {
    return { ok: false, error: 'Farmacia no válida.' };
  }

  const write = await hasPlatformPermission('platform.pharmacies.write');
  if (write.ok) {
    const { profile, authenticated } = await getCurrentProfile();
    if (!authenticated || !profile) {
      return { ok: false, error: 'Debes iniciar sesión.' };
    }
    return {
      ok: true,
      profile,
      via: 'platform',
      actorId: profile.id,
    };
  }

  const membership = await requireActivePharmacyMembership(id);
  if (!membership.ok) {
    return {
      ok: false,
      error: 'No tienes acceso activo a esta farmacia.',
    };
  }

  const supabase = createClient();
  const { data: hasPerm, error } = await supabase.rpc(
    'ff_has_pharmacy_permission',
    {
      p_pharmacy_id: id,
      p_permission_key: 'branding.update',
    }
  );

  if (error) {
    console.error('[pharmacy-logo-authz]', error.code, error.message);
    return {
      ok: false,
      error: 'No se ha podido verificar el permiso de branding.',
    };
  }

  if (!hasPerm) {
    return {
      ok: false,
      error:
        'Solo el propietario o el administrador pueden gestionar el logo de la farmacia.',
    };
  }

  return {
    ok: true,
    profile: membership.profile,
    via: 'membership',
    actorId: membership.profile.id,
  };
}
