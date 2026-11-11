/**
 * Autorización para gestionar el logo de farmacia.
 * Exclusivo SuperAdmin (`platform.pharmacies.write`).
 * Owner / Admin / Farmacéutico / STAFF: denegado (solicitud escrita → SA).
 */

import {
  getCurrentProfile,
  hasPlatformPermission,
  type CurrentProfile,
} from '@/lib/auth/platform';

export type PharmacyLogoAuthzResult =
  | {
      ok: true;
      profile: CurrentProfile;
      via: 'platform';
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
  if (!write.ok) {
    return {
      ok: false,
      error:
        'Solo SuperAdmin puede cambiar el logo. El titular debe solicitarlo por escrito a FarmaFácil.',
    };
  }

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
