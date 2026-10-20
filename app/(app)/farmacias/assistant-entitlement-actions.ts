'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import {
  getCurrentProfile,
  hasPlatformPermission,
} from '@/lib/auth/platform';
import {
  isAssistantSuperAdminAction,
  type AssistantSuperAdminAction,
} from '@/lib/kiosk/assistant/entitlement-actions-policy';

export type AssistantEntitlementAction = AssistantSuperAdminAction;

export type SetAssistantEntitlementResult =
  | {
      ok: true;
      message: string;
      status: string;
      mode: string;
      endsAt: string | null;
      moduleActiveNow: boolean;
    }
  | { ok: false; error: string };

const ACTION_MESSAGES: Record<AssistantEntitlementAction, string> = {
  activate_demo: 'Modo DEMO del Asistente IA activado (autorización expresa).',
  activate_contracted: 'Asistente IA contratado activado.',
  update_limits: 'Límites / opciones del Asistente IA actualizados.',
  suspend: 'Asistente IA suspendido.',
  reactivate: 'Asistente IA reactivado.',
  cancel: 'Asistente IA desactivado (cancelado).',
};

/**
 * SuperAdmin: gestiona entitlement assistant_ai. No registra cobros.
 */
export async function setPharmacyAssistantEntitlementAction(input: {
  pharmacyId: string;
  action: AssistantEntitlementAction;
  monthlyRequestLimit?: number | null;
  endsAt?: string | null;
  pharmacistConsultEnabled?: boolean | null;
  reason?: string | null;
}): Promise<SetAssistantEntitlementResult> {
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
  if (!isAssistantSuperAdminAction(action)) {
    return { ok: false, error: 'Acción no reconocida.' };
  }

  let endsAt: string | null = input.endsAt?.trim() || null;
  if (action === 'activate_demo' || action === 'reactivate') {
    if (action === 'activate_demo') {
      if (!endsAt) {
        return {
          ok: false,
          error: 'La demo requiere una fecha de vencimiento.',
        };
      }
      const endsMs = Date.parse(endsAt);
      if (!Number.isFinite(endsMs) || endsMs <= Date.now()) {
        return {
          ok: false,
          error: 'La fecha de vencimiento de la demo debe ser futura.',
        };
      }
    }
  } else if (action !== 'update_limits') {
    endsAt = null;
  }

  let monthlyRequestLimit: number | null =
    input.monthlyRequestLimit != null &&
    Number.isFinite(input.monthlyRequestLimit)
      ? Math.floor(input.monthlyRequestLimit)
      : null;

  if (
    (action === 'activate_demo' ||
      action === 'activate_contracted' ||
      action === 'update_limits') &&
    monthlyRequestLimit != null &&
    (monthlyRequestLimit < 1 || monthlyRequestLimit > 1_000_000)
  ) {
    return { ok: false, error: 'Límite mensual no válido.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_set_pharmacy_assistant_entitlement_v1',
    {
      p_pharmacy_id: pharmacyId,
      p_action: action,
      p_monthly_request_limit: monthlyRequestLimit,
      p_ends_at: endsAt,
      p_pharmacist_consult_enabled:
        input.pharmacistConsultEnabled === undefined
          ? null
          : input.pharmacistConsultEnabled,
      p_reason: input.reason?.trim() || null,
    }
  );

  if (error) {
    console.error('[assistant] set entitlement', error.message);
    return {
      ok: false,
      error: error.message || 'No se ha podido actualizar el Asistente IA.',
    };
  }

  const payload = data as {
    ok?: boolean;
    status?: string;
    mode?: string;
    ends_at?: string | null;
    module_active_now?: boolean;
  } | null;

  revalidatePath(`/farmacias/${pharmacyId}`);
  revalidatePath(`/f/${pharmacyId}/asistente`);

  return {
    ok: true,
    message: ACTION_MESSAGES[action],
    status: String(payload?.status ?? ''),
    mode: String(payload?.mode ?? ''),
    endsAt: payload?.ends_at ?? null,
    moduleActiveNow: payload?.module_active_now === true,
  };
}
