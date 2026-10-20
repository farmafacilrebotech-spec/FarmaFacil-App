import { createClient } from '@/lib/supabase/server';
import {
  getCurrentProfile,
  hasPlatformPermission,
} from '@/lib/auth/platform';
import { requireActivePharmacyMembership } from '@/lib/auth/access';

export type ConsultsAuth =
  | { ok: true; actorId: string; via: 'platform' | 'membership' }
  | { ok: false; error: string };

async function requireConsultPermission(
  pharmacyId: string,
  permissionKey: 'assistant.consults.view' | 'assistant.consults.manage'
): Promise<ConsultsAuth> {
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

  const platform =
    permissionKey === 'assistant.consults.manage'
      ? await hasPlatformPermission('platform.pharmacies.write')
      : await hasPlatformPermission('platform.pharmacies.read');
  if (platform.ok) {
    return { ok: true, actorId: profile.id, via: 'platform' };
  }

  if (permissionKey === 'assistant.consults.view') {
    const platformWrite = await hasPlatformPermission(
      'platform.pharmacies.write'
    );
    if (platformWrite.ok) {
      return { ok: true, actorId: profile.id, via: 'platform' };
    }
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
      p_permission_key: permissionKey,
    }
  );

  if (permError) {
    console.error('[assistant-consults] permission', permError.message);
    return {
      ok: false,
      error: 'No se ha podido verificar el permiso de consultas.',
    };
  }

  if (data !== true) {
    return {
      ok: false,
      error:
        permissionKey === 'assistant.consults.manage'
          ? 'No tienes permiso para gestionar consultas del asistente.'
          : 'No tienes permiso para ver consultas del asistente.',
    };
  }

  return { ok: true, actorId: profile.id, via: 'membership' };
}

export function requireConsultsView(pharmacyId: string): Promise<ConsultsAuth> {
  return requireConsultPermission(pharmacyId, 'assistant.consults.view');
}

export function requireConsultsManage(
  pharmacyId: string
): Promise<ConsultsAuth> {
  return requireConsultPermission(pharmacyId, 'assistant.consults.manage');
}
