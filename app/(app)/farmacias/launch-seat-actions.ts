'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import {
  getCurrentProfile,
  hasPlatformSuperAdminRole,
} from '@/lib/auth/platform';
import {
  plansKeyToPaidSku,
  type PaidCommercialSku,
} from '@/lib/pharmacies/commercial-assign-pricing';

export type LaunchSeatActionResult =
  | { ok: true; message: string; payload?: Record<string, unknown> }
  | { ok: false; error: string };

async function requireSuperAdminTotal(): Promise<
  | { ok: true; profileId: string }
  | { ok: false; error: string }
> {
  const { profile, authenticated } = await getCurrentProfile();
  if (!authenticated || !profile) {
    return { ok: false, error: 'Debe iniciar sesión.' };
  }
  const role = await hasPlatformSuperAdminRole(profile.id);
  if (!role.ok) {
    return {
      ok: false,
      error: 'Solo SuperAdmin Total puede gestionar plazas de lanzamiento.',
    };
  }
  return { ok: true, profileId: profile.id };
}

function mapRpcError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('launch_slots_exhausted')) {
    return 'No quedan plazas de lanzamiento 2027 (máximo 20).';
  }
  if (m.includes('launch_seat_committed')) {
    return (
      'Plaza comprometida (contrato, factura o descuento bloqueado). ' +
      'No se puede liberar de forma simple: use el procedimiento jurídico/comercial.'
    );
  }
  if (m.includes('launch_release_reason_required')) {
    return 'Indique un motivo de liberación (mínimo 3 caracteres).';
  }
  if (m.includes('launch_extend_reason_required')) {
    return 'Indique un motivo de ampliación (mínimo 3 caracteres).';
  }
  if (m.includes('launch_confirm_requires_formalization') || m.includes('fixture')) {
    return 'Confirmación bloqueada: formalización válida o fixture [STAGING_FIXTURE] en staging.';
  }
  if (m.includes('forbidden_holder_reserve')) {
    return 'Solo el titular de la farmacia puede reservar la plaza promocional.';
  }
  if (m.includes('launch_promo_invalid_sku') || m.includes('launch_promo_not_for_pilot')) {
    return 'El plan seleccionado no admite plaza de lanzamiento.';
  }
  if (m.includes('not_authenticated') || m.includes('42501')) {
    return 'Sin permiso para esta operación.';
  }
  return message || 'No se pudo completar la operación de plaza.';
}

function revalidateLaunchPaths(pharmacyId: string) {
  revalidatePath('/contratos');
  revalidatePath('/farmacias');
  revalidatePath(`/farmacias/${pharmacyId}`);
  revalidatePath('/dashboard');
}

/** Reserva plaza sin cambiar el plan (usa RPC atómico). Preferible si ya está en plan de pago. */
export async function reserveLaunchSeatAction(
  pharmacyId: string,
  commercialSkuKey: string
): Promise<LaunchSeatActionResult> {
  const gate = await requireSuperAdminTotal();
  if (!gate.ok) return gate;

  const sku = plansKeyToPaidSku(commercialSkuKey) as PaidCommercialSku | null;
  if (!sku) {
    return { ok: false, error: 'Seleccione un plan de pago elegible (General / Personalizado / IA).' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_reserve_launch_2027_seat_v1', {
    p_pharmacy_id: pharmacyId,
    p_commercial_sku_key: sku,
  });

  if (error) {
    console.error('[launch-seat] reserve', error.code, error.message);
    return { ok: false, error: mapRpcError(error.message) };
  }

  revalidateLaunchPaths(pharmacyId);
  return {
    ok: true,
    message: 'Plaza de lanzamiento 2027 reservada.',
    payload: (data as Record<string, unknown>) ?? undefined,
  };
}

/**
 * Libera plaza activa sin cambiar plan ni desactivar farmacia.
 * Exige motivo. Bloquea si la plaza está confirmada/comprometida (RPC 089).
 */
export async function releaseLaunchSeatAction(
  pharmacyId: string,
  reason: string
): Promise<LaunchSeatActionResult> {
  const gate = await requireSuperAdminTotal();
  if (!gate.ok) return gate;

  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    return { ok: false, error: 'Indique un motivo de liberación (mínimo 3 caracteres).' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_release_launch_seat_v1', {
    p_pharmacy_id: pharmacyId,
    p_reason: trimmed,
  });

  if (error) {
    console.error('[launch-seat] release', error.code, error.message);
    return { ok: false, error: mapRpcError(error.message) };
  }

  const payload = (data as Record<string, unknown>) ?? {};
  if (payload.released === false) {
    return { ok: false, error: 'No hay una plaza activa que liberar para esta farmacia.' };
  }

  revalidateLaunchPaths(pharmacyId);
  return {
    ok: true,
    message:
      'Plaza liberada. La farmacia, su plan y su suscripción no se han modificado.',
    payload,
  };
}

/** Ampliación de caducidad (solo SA Total). Motivo obligatorio. */
export async function extendLaunchSeatAction(
  pharmacyId: string,
  extraDays: number,
  reason: string
): Promise<LaunchSeatActionResult> {
  const gate = await requireSuperAdminTotal();
  if (!gate.ok) return gate;

  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    return { ok: false, error: 'Indique un motivo de ampliación (mínimo 3 caracteres).' };
  }
  if (!Number.isFinite(extraDays) || extraDays < 1 || extraDays > 90) {
    return { ok: false, error: 'Días de ampliación inválidos (1–90).' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_extend_launch_seat_v1', {
    p_pharmacy_id: pharmacyId,
    p_extra_days: Math.floor(extraDays),
    p_reason: trimmed,
  });

  if (error) {
    console.error('[launch-seat] extend', error.code, error.message);
    return { ok: false, error: mapRpcError(error.message) };
  }

  revalidateLaunchPaths(pharmacyId);
  return {
    ok: true,
    message: 'Caducidad de la reserva ampliada. Plan y suscripción sin cambios.',
    payload: (data as Record<string, unknown>) ?? undefined,
  };
}

/**
 * Confirmación irreversible. En staging exige fixture [STAGING_FIXTURE]
 * mientras la formalización jurídica esté bloqueada.
 */
export async function confirmLaunchSeatAction(
  pharmacyId: string,
  commitmentKind: string,
  notes: string
): Promise<LaunchSeatActionResult> {
  const gate = await requireSuperAdminTotal();
  if (!gate.ok) return gate;

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_confirm_launch_seat_v1', {
    p_pharmacy_id: pharmacyId,
    p_commitment_kind: commitmentKind.trim() || 'staging_fixture',
    p_notes: notes.trim() || '[STAGING_FIXTURE]',
  });

  if (error) {
    console.error('[launch-seat] confirm', error.code, error.message);
    return { ok: false, error: mapRpcError(error.message) };
  }

  revalidateLaunchPaths(pharmacyId);
  return {
    ok: true,
    message: 'Plaza confirmada (irreversible por operaciones ordinarias).',
    payload: (data as Record<string, unknown>) ?? undefined,
  };
}

/** Reserva por titular (OWNER). Empleados: denegado en RPC. */
export async function holderReserveLaunchSeatAction(
  pharmacyId: string,
  commercialSkuKey: string,
  ackConditions: boolean
): Promise<LaunchSeatActionResult> {
  const sku = plansKeyToPaidSku(commercialSkuKey) as PaidCommercialSku | null;
  if (!sku) {
    return {
      ok: false,
      error: 'Seleccione un plan promocional (General / Personalizado / IA).',
    };
  }
  if (!ackConditions) {
    return {
      ok: false,
      error: 'Debe aceptar las condiciones y la fecha de caducidad.',
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_holder_reserve_launch_2027_seat_v1',
    {
      p_pharmacy_id: pharmacyId,
      p_commercial_sku_key: sku,
      p_ack_conditions: true,
    }
  );

  if (error) {
    console.error('[launch-seat] holder_reserve', error.code, error.message);
    return { ok: false, error: mapRpcError(error.message) };
  }

  revalidateLaunchPaths(pharmacyId);
  return {
    ok: true,
    message: 'Plaza reservada. SuperAdmin ha sido notificado internamente.',
    payload: (data as Record<string, unknown>) ?? undefined,
  };
}
