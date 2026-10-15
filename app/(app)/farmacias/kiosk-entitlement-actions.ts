'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import {
  getCurrentProfile,
  hasPlatformPermission,
} from '@/lib/auth/platform';

export type KioskEntitlementAction =
  | 'activate_trial'
  | 'activate_addon'
  | 'suspend'
  | 'reactivate'
  | 'cancel';

export type SetKioskEntitlementResult =
  | {
      ok: true;
      message: string;
      status: string;
      endsAt: string | null;
      moduleActiveNow: boolean;
    }
  | { ok: false; error: string };

const ACTION_MESSAGES: Record<KioskEntitlementAction, string> = {
  activate_trial: 'Prueba de Kiosko activada.',
  activate_addon: 'Add-on Kiosko activado (autorización comercial).',
  suspend: 'Kiosko suspendido. Los dispositivos quedan bloqueados.',
  reactivate: 'Kiosko reactivado.',
  cancel: 'Kiosko cancelado. Los dispositivos se conservan bloqueados.',
};

/**
 * SuperAdmin: gestiona entitlement kiosk (add-on). No registra cobros ni Stripe.
 */
export async function setPharmacyKioskEntitlementAction(input: {
  pharmacyId: string;
  action: KioskEntitlementAction;
  endsAt?: string | null;
  reason?: string | null;
}): Promise<SetKioskEntitlementResult> {
  const pharmacyId = input.pharmacyId?.trim() ?? '';
  if (!pharmacyId || !/^[0-9a-f-]{36}$/i.test(pharmacyId)) {
    return { ok: false, error: 'Farmacia no válida.' };
  }

  const { profile, authenticated } = await getCurrentProfile();
  if (!authenticated || !profile) {
    return { ok: false, error: 'Debes iniciar sesión.' };
  }

  const canManage = await hasPlatformPermission('platform.entitlements.manage');
  if (!canManage.ok) {
    return {
      ok: false,
      error: 'No tienes permiso para gestionar entitlements de farmacia.',
    };
  }

  const action = input.action;
  if (
    ![
      'activate_trial',
      'activate_addon',
      'suspend',
      'reactivate',
      'cancel',
    ].includes(action)
  ) {
    return { ok: false, error: 'Acción no reconocida.' };
  }

  let endsAt: string | null = input.endsAt?.trim() || null;
  if (action === 'activate_trial') {
    if (!endsAt) {
      return {
        ok: false,
        error: 'La prueba requiere una fecha de vencimiento.',
      };
    }
    const endsMs = Date.parse(endsAt);
    if (!Number.isFinite(endsMs) || endsMs <= Date.now()) {
      return {
        ok: false,
        error: 'La fecha de vencimiento de la prueba debe ser futura.',
      };
    }
  } else {
    endsAt = null;
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_set_pharmacy_kiosk_entitlement_v1',
    {
      p_pharmacy_id: pharmacyId,
      p_action: action,
      p_ends_at: endsAt,
      p_reason: input.reason?.trim() || null,
    }
  );

  if (error) {
    console.error('[kiosk] set entitlement', error.message);
    return {
      ok: false,
      error: error.message || 'No se ha podido actualizar el módulo Kiosko.',
    };
  }

  const payload = data as {
    ok?: boolean;
    status?: string;
    ends_at?: string | null;
    module_active_now?: boolean;
  } | null;

  revalidatePath(`/farmacias/${pharmacyId}`);
  revalidatePath(`/f/${pharmacyId}/dispositivos`);

  return {
    ok: true,
    message: ACTION_MESSAGES[action],
    status: String(payload?.status ?? ''),
    endsAt: payload?.ends_at ?? null,
    moduleActiveNow: payload?.module_active_now === true,
  };
}
