'use server';

import {
  getCurrentProfile,
  hasPlatformSuperAdminRole,
} from '@/lib/auth/platform';
import {
  PHARMACY_MATERIALS_SUPERADMIN_ONLY_MESSAGE,
  canGeneratePharmacyMaterials,
} from '@/lib/pharmacies/pharmacy-materials-access';

/**
 * Autorización server-side para carteles / pack de bienvenida.
 * Debe invocarse antes de generar PDF en cliente; no sustituye el gate UI.
 */
export async function assertPharmacyMaterialsAccessAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { profile } = await getCurrentProfile();
  if (!profile?.id) {
    return { ok: false, error: PHARMACY_MATERIALS_SUPERADMIN_ONLY_MESSAGE };
  }
  const sa = await hasPlatformSuperAdminRole(profile.id);
  if (!canGeneratePharmacyMaterials(sa.ok)) {
    return { ok: false, error: PHARMACY_MATERIALS_SUPERADMIN_ONLY_MESSAGE };
  }
  return { ok: true };
}
