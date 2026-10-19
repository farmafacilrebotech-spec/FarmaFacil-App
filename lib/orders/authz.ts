import { createClient } from '@/lib/supabase/server';
import {
  getCurrentProfile,
  hasPlatformPermission,
} from '@/lib/auth/platform';
import { requireActivePharmacyMembership } from '@/lib/auth/access';

export type OrdersAuth =
  | { ok: true; actorId: string; via: 'platform' | 'membership' }
  | { ok: false; error: string };

async function requireOrdersPermission(
  pharmacyId: string,
  permissionKey: 'orders.view' | 'orders.manage'
): Promise<OrdersAuth> {
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
    permissionKey === 'orders.manage'
      ? await hasPlatformPermission('platform.pharmacies.write')
      : await hasPlatformPermission('platform.pharmacies.read');
  if (platform.ok) {
    return { ok: true, actorId: profile.id, via: 'platform' };
  }

  // write también cubre lectura
  if (permissionKey === 'orders.view') {
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
    console.error('[orders] permission', permError.message);
    return {
      ok: false,
      error: 'No se ha podido verificar el permiso de pedidos.',
    };
  }

  if (data !== true) {
    return {
      ok: false,
      error:
        permissionKey === 'orders.manage'
          ? 'No tienes permiso para gestionar pedidos de esta farmacia.'
          : 'No tienes permiso para ver pedidos de esta farmacia.',
    };
  }

  return { ok: true, actorId: profile.id, via: 'membership' };
}

export function requireOrdersView(pharmacyId: string): Promise<OrdersAuth> {
  return requireOrdersPermission(pharmacyId, 'orders.view');
}

export function requireOrdersManage(pharmacyId: string): Promise<OrdersAuth> {
  return requireOrdersPermission(pharmacyId, 'orders.manage');
}
