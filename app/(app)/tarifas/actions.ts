'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { hasPlatformPermission } from '@/lib/auth/platform';
import { mapCommercialRpcError } from '@/lib/commercial/rpc-errors';
import {
  fetchTrialReadiness,
  type ReadinessResult,
} from '@/lib/commercial/pilots-queries';
import { getPharmacyHomeEntrypoint } from '@/lib/pharmacies/pharmacy-home-entrypoint';

export type ActionResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

function revalidateCommercialPaths(pharmacyId?: string) {
  revalidatePath('/tarifas');
  if (pharmacyId) {
    revalidatePath(`/farmacias/${pharmacyId}`);
  }
}

async function requireTrialsManage(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const r = await hasPlatformPermission('platform.commercial_trials.manage');
  if (!r.ok) {
    return {
      ok: false,
      error: 'No tienes permiso para gestionar pilotos comerciales.',
    };
  }
  return { ok: true };
}

/**
 * Alta comercial: farmacia + trial ready + catálogo maestro + QR.
 * NO activa el reloj del piloto.
 */
export async function createPharmacyCommercialPrepAction(input: {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  legalName?: string;
}): Promise<
  ActionResult<{
    pharmacyId: string;
    trialId: string;
    trialStatus: string;
    catalogMode: string;
    publicUrl: string | null;
    attachInserted: number | null;
    ready: boolean | null;
  }>
> {
  const gate = await requireTrialsManage();
  if (!gate.ok) return gate;

  const name = input.name?.trim() ?? '';
  if (!name) {
    return { ok: false, error: 'El nombre de la farmacia es obligatorio.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_create_pharmacy_commercial_prep_v1',
    {
      p_name: name,
      p_legal_name: input.legalName?.trim() || null,
      p_email: input.email?.trim() || null,
      p_phone: input.phone?.trim() || null,
      p_city: input.city?.trim() || null,
    }
  );

  if (error) {
    console.error('[commercial] prep_create', error.code, error.message);
    return {
      ok: false,
      error: mapCommercialRpcError(error.message, error.code),
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  if (!payload || payload.status !== 'ok') {
    return { ok: false, error: 'Respuesta inesperada al preparar la farmacia.' };
  }

  const pharmacyId = String(payload.pharmacy_id ?? '');
  const trialId = String(payload.trial_id ?? '');
  const attach =
    payload.master_catalog_attach &&
    typeof payload.master_catalog_attach === 'object'
      ? (payload.master_catalog_attach as Record<string, unknown>)
      : null;
  const readiness =
    payload.readiness && typeof payload.readiness === 'object'
      ? (payload.readiness as Record<string, unknown>)
      : null;

  let publicUrl: string | null = null;
  if (pharmacyId) {
    const ep = await getPharmacyHomeEntrypoint(pharmacyId);
    if (ep.ok && ep.entrypoint) {
      publicUrl = ep.entrypoint.publicUrl;
    } else {
      const epPayload =
        payload.entrypoint && typeof payload.entrypoint === 'object'
          ? (payload.entrypoint as Record<string, unknown>)
          : null;
      const publicId =
        typeof epPayload?.public_id === 'string' ? epPayload.public_id : null;
      if (publicId) {
        publicUrl = `/e/${publicId}`;
      }
    }
  }

  revalidateCommercialPaths(pharmacyId || undefined);

  return {
    ok: true,
    pharmacyId,
    trialId,
    trialStatus: String(payload.trial_status ?? 'ready'),
    catalogMode: String(payload.catalog_mode ?? 'generic'),
    publicUrl,
    attachInserted:
      attach?.inserted != null ? Number(attach.inserted) : null,
    ready: readiness?.ready != null ? Boolean(readiness.ready) : null,
  };
}

export async function getTrialReadinessAction(
  pharmacyId: string
): Promise<ReadinessResult> {
  return fetchTrialReadiness(pharmacyId);
}

/**
 * Activa el piloto de 15 días (relój comercial). Requiere readiness.
 * No llamar al crear la farmacia.
 */
export async function activateCommercialTrialAction(
  pharmacyId: string
): Promise<ActionResult<{ trialStatus: string; endsAt: string | null }>> {
  const gate = await requireTrialsManage();
  if (!gate.ok) return gate;
  if (!pharmacyId) return { ok: false, error: 'Farmacia no indicada.' };

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_commercial_trial_activate_v1',
    { p_pharmacy_id: pharmacyId }
  );

  if (error) {
    console.error('[commercial] activate', error.code, error.message);
    return {
      ok: false,
      error: mapCommercialRpcError(error.message, error.code),
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  if (!payload || payload.status !== 'ok') {
    return { ok: false, error: 'No se ha podido activar el piloto.' };
  }

  revalidateCommercialPaths(pharmacyId);
  return {
    ok: true,
    trialStatus: String(payload.trial_status ?? 'active'),
    endsAt: payload.ends_at != null ? String(payload.ends_at) : null,
  };
}

export async function extendCommercialTrialAction(
  pharmacyId: string,
  reason: string
): Promise<ActionResult<{ trialStatus: string; endsAt: string | null }>> {
  const gate = await requireTrialsManage();
  if (!gate.ok) return gate;
  if (!pharmacyId) return { ok: false, error: 'Farmacia no indicada.' };

  const trimmed = reason?.trim() ?? '';
  if (trimmed.length < 3) {
    return {
      ok: false,
      error: 'Indica un motivo de ampliación (mín. 3 caracteres).',
    };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_commercial_trial_extend_v1',
    { p_pharmacy_id: pharmacyId, p_reason: trimmed }
  );

  if (error) {
    console.error('[commercial] extend', error.code, error.message);
    return {
      ok: false,
      error: mapCommercialRpcError(error.message, error.code),
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  if (!payload || payload.status !== 'ok') {
    return { ok: false, error: 'No se ha podido ampliar el piloto.' };
  }

  revalidateCommercialPaths(pharmacyId);
  return {
    ok: true,
    trialStatus: String(payload.trial_status ?? 'extended'),
    endsAt: payload.ends_at != null ? String(payload.ends_at) : null,
  };
}

export async function endCommercialTrialAction(
  pharmacyId: string,
  reason?: string
): Promise<ActionResult<{ trialStatus: string }>> {
  const gate = await requireTrialsManage();
  if (!gate.ok) return gate;
  if (!pharmacyId) return { ok: false, error: 'Farmacia no indicada.' };

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_commercial_trial_end_v1', {
    p_pharmacy_id: pharmacyId,
    p_reason: reason?.trim() || null,
  });

  if (error) {
    console.error('[commercial] end', error.code, error.message);
    return {
      ok: false,
      error: mapCommercialRpcError(error.message, error.code),
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  if (!payload || payload.status !== 'ok') {
    return { ok: false, error: 'No se ha podido finalizar el piloto.' };
  }

  revalidateCommercialPaths(pharmacyId);
  return {
    ok: true,
    trialStatus: String(payload.trial_status ?? 'ended'),
  };
}

export async function attachMasterCatalogAction(
  pharmacyId: string
): Promise<ActionResult<{ inserted: number | null; activeGeneric: number | null }>> {
  const write = await hasPlatformPermission('platform.pharmacies.write');
  if (!write.ok) {
    return { ok: false, error: 'Sin permiso para adjuntar el catálogo maestro.' };
  }
  if (!pharmacyId) return { ok: false, error: 'Farmacia no indicada.' };

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_attach_master_catalog_v1', {
    p_pharmacy_id: pharmacyId,
  });

  if (error) {
    console.error('[commercial] attach', error.code, error.message);
    return {
      ok: false,
      error: mapCommercialRpcError(error.message, error.code),
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  revalidateCommercialPaths(pharmacyId);
  return {
    ok: true,
    inserted: payload?.inserted != null ? Number(payload.inserted) : null,
    activeGeneric:
      payload?.active_generic_or_demo_rows != null
        ? Number(payload.active_generic_or_demo_rows)
        : null,
  };
}

export async function syncMasterCatalogAction(
  pharmacyId?: string | null
): Promise<ActionResult<{ updated: number | null }>> {
  const write = await hasPlatformPermission('platform.pharmacies.write');
  if (!write.ok) {
    return { ok: false, error: 'Sin permiso para sincronizar el catálogo maestro.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_sync_master_catalog_v1', {
    p_pharmacy_id: pharmacyId || null,
  });

  if (error) {
    console.error('[commercial] sync', error.code, error.message);
    return {
      ok: false,
      error: mapCommercialRpcError(error.message, error.code),
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  revalidateCommercialPaths(pharmacyId || undefined);
  return {
    ok: true,
    updated: payload?.updated != null ? Number(payload.updated) : null,
  };
}

export async function setPharmacyCatalogModeAction(
  pharmacyId: string,
  mode: 'generic' | 'own'
): Promise<ActionResult<{ from: string | null; to: string }>> {
  const write = await hasPlatformPermission('platform.pharmacies.write');
  const trials = await hasPlatformPermission('platform.commercial_trials.manage');
  if (!write.ok && !trials.ok) {
    return { ok: false, error: 'Sin permiso para cambiar la modalidad de catálogo.' };
  }
  if (!pharmacyId) return { ok: false, error: 'Farmacia no indicada.' };
  if (mode !== 'generic' && mode !== 'own') {
    return { ok: false, error: 'Modalidad no válida.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_set_pharmacy_catalog_mode_v1',
    { p_pharmacy_id: pharmacyId, p_mode: mode }
  );

  if (error) {
    console.error('[commercial] set_mode', error.code, error.message);
    return {
      ok: false,
      error: mapCommercialRpcError(error.message, error.code),
    };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  revalidateCommercialPaths(pharmacyId);
  return {
    ok: true,
    from: payload?.from != null ? String(payload.from) : null,
    to: String(payload?.to ?? mode),
  };
}

export async function updateMasterCatalogProductAction(input: {
  id: string;
  name: string;
  categoryName: string;
  subcategoryName: string;
  activeStandardCatalog: boolean;
}): Promise<ActionResult> {
  const write = await hasPlatformPermission('platform.pharmacies.write');
  if (!write.ok) {
    return {
      ok: false,
      error: 'Solo SuperAdmin con platform.pharmacies.write puede editar el maestro.',
    };
  }

  const id = input.id?.trim() ?? '';
  const name = input.name?.trim() ?? '';
  const categoryName = input.categoryName?.trim() ?? '';
  const subcategoryName = input.subcategoryName?.trim() ?? '';
  if (!id || !name || !categoryName || !subcategoryName) {
    return { ok: false, error: 'Completa id, nombre, categoría y subcategoría.' };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('ff_master_catalog_products')
    .update({
      generic_product_type: name,
      category_name: categoryName,
      subcategory_name: subcategoryName,
      active_standard_catalog: input.activeStandardCatalog,
    })
    .eq('id', id);

  if (error) {
    console.error('[commercial] master update', error.code, error.message);
    return {
      ok: false,
      error: mapCommercialRpcError(error.message, error.code),
    };
  }

  revalidatePath('/tarifas');
  return { ok: true };
}
