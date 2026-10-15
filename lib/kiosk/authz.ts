import { createClient } from '@/lib/supabase/server';
import {
  getCurrentProfile,
  hasPlatformPermission,
} from '@/lib/auth/platform';
import { requireActivePharmacyMembership } from '@/lib/auth/access';

export type KioskManageAuth =
  | {
      ok: true;
      actorId: string;
      via: 'platform' | 'membership';
    }
  | { ok: false; error: string };

/**
 * Comprueba operable + entitlement módulo kiosk (espejo SQL ff_kiosk_pharmacy_runtime_allowed).
 * Obligatoria al generar códigos; el canje/validate la repiten en servidor.
 */
export async function requireKioskCommercialAccess(
  pharmacyId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_kiosk_pharmacy_runtime_allowed',
    { p_pharmacy_id: pharmacyId }
  );

  if (error) {
    console.error('[kiosk] commercial gate', error.message);
    return {
      ok: false,
      error:
        'No se ha podido verificar el derecho comercial al módulo kiosko.',
    };
  }

  if (data !== true) {
    return {
      ok: false,
      error:
        'La farmacia no está operable o no tiene el módulo kiosko activo. No se pueden generar códigos de vinculación.',
    };
  }

  return { ok: true };
}

/**
 * Autoriza gestión de dispositivos kiosko:
 * - SuperAdmin con platform.pharmacies.write, o
 * - Membership active + permiso kiosk.devices.manage (OWNER/ADMIN vía seed 035).
 * El entitlement comercial se exige aparte en createKioskPairingCodeAction.
 */
export async function requireKioskDevicesManage(
  pharmacyId: string
): Promise<KioskManageAuth> {
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

  const platformWrite = await hasPlatformPermission('platform.pharmacies.write');
  if (platformWrite.ok) {
    return { ok: true, actorId: profile.id, via: 'platform' };
  }

  const membership = await requireActivePharmacyMembership(pharmacyId);
  if (!membership.ok) {
    return {
      ok: false,
      error: 'No tienes acceso activo a esta farmacia.',
    };
  }

  const supabase = createClient();
  const { data, error: permError } = await supabase.rpc(
    'ff_has_pharmacy_permission',
    {
      p_pharmacy_id: pharmacyId,
      p_permission_key: 'kiosk.devices.manage',
    }
  );

  if (permError) {
    console.error('[kiosk] permission', permError.message);
    return {
      ok: false,
      error: 'No se ha podido verificar el permiso de kiosko.',
    };
  }

  if (data !== true) {
    return {
      ok: false,
      error:
        'Solo el propietario o administrador de la farmacia puede gestionar dispositivos kiosko.',
    };
  }

  return { ok: true, actorId: profile.id, via: 'membership' };
}

export async function requireKioskDevicesView(
  pharmacyId: string
): Promise<KioskManageAuth> {
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

  const platformRead = await hasPlatformPermission('platform.pharmacies.read');
  const platformWrite = await hasPlatformPermission('platform.pharmacies.write');
  if (platformRead.ok || platformWrite.ok) {
    return { ok: true, actorId: profile.id, via: 'platform' };
  }

  const membership = await requireActivePharmacyMembership(pharmacyId);
  if (!membership.ok) {
    return {
      ok: false,
      error: 'No tienes acceso activo a esta farmacia.',
    };
  }

  const supabase = createClient();
  const { data: canManage } = await supabase.rpc('ff_has_pharmacy_permission', {
    p_pharmacy_id: pharmacyId,
    p_permission_key: 'kiosk.devices.manage',
  });
  const { data: canView } = await supabase.rpc('ff_has_pharmacy_permission', {
    p_pharmacy_id: pharmacyId,
    p_permission_key: 'kiosk.devices.view',
  });

  if (canManage === true || canView === true) {
    return { ok: true, actorId: profile.id, via: 'membership' };
  }

  return {
    ok: false,
    error: 'No tienes permiso para ver dispositivos kiosko.',
  };
}
