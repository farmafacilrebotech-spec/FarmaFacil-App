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
import { PHARMACY_IDENTITY_CHANGE_POLICY } from '@/lib/pharmacies/pharmacy-identity-fields';

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
      error: PHARMACY_IDENTITY_CHANGE_POLICY,
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
