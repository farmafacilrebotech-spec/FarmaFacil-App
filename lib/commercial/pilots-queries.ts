import { createClient } from '@/lib/supabase/server';
import { hasPlatformPermission } from '@/lib/auth/platform';
import {
  ALL_PHARMACY_PRODUCTS_KEY,
  loadPharmacyProductCounts,
} from '@/lib/commercial/pharmacy-product-counts';
import { pharmacyEntrypointPublicUrl } from '@/lib/kiosk/entrypoint-url';

export type CommercialTrialStatus =
  | 'draft'
  | 'ready'
  | 'active'
  | 'extended'
  | 'ended'
  | 'converted'
  | 'cancelled';

/** Plan comercial en prueba (piloto ≠ 4º plan). */
export type PilotTrialPlanSku =
  | 'general'
  | 'personalized'
  | 'ai_personalized';

export type CommercialPilotRow = {
  trialId: string;
  pharmacyId: string;
  pharmacyName: string;
  pharmacyStatus: string;
  trialStatus: CommercialTrialStatus;
  /** Plan G/P/IA en prueba; null si aún no se eligió / migración 095 pendiente. */
  trialPlanSku: PilotTrialPlanSku | null;
  preparedAt: string | null;
  activatedAt: string | null;
  endsAt: string | null;
  extensionUsed: boolean;
  extendedAt: string | null;
  catalogMode: 'generic' | 'own';
  genericProductCount: number;
  daysRemaining: number | null;
  publicUrl: string | null;
};

export type PilotKpis = {
  active: number;
  expiringSoon: number;
  ended: number;
  extended: number;
};

function daysRemaining(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export async function canManageCommercialTrials(): Promise<boolean> {
  const r = await hasPlatformPermission('platform.commercial_trials.manage');
  return r.ok;
}

/**
 * Lista pilotos comerciales (RLS: platform.commercial_trials.manage).
 * Sin inventar filas.
 */
export async function listCommercialPilots(): Promise<{
  ok: true;
  rows: CommercialPilotRow[];
  kpis: PilotKpis;
} | { ok: false; error: string }> {
  const allowed = await canManageCommercialTrials();
  if (!allowed) {
    return { ok: false, error: 'Sin permiso platform.commercial_trials.manage.' };
  }

  const supabase = createClient();
  const selectWithPlan = `
      id,
      pharmacy_id,
      status,
      trial_plan_sku,
      prepared_at,
      activated_at,
      ends_at,
      extension_used,
      extended_at,
      pharmacies!inner (
        id,
        name,
        status
      )
    `;
  const selectLegacy = `
      id,
      pharmacy_id,
      status,
      prepared_at,
      activated_at,
      ends_at,
      extension_used,
      extended_at,
      pharmacies!inner (
        id,
        name,
        status
      )
    `;

  let data: unknown[] | null = null;
  let error: { code?: string; message: string } | null = null;

  {
    const first = await supabase
      .from('pharmacy_commercial_trials')
      .select(selectWithPlan)
      .order('created_at', { ascending: false })
      .limit(200);
    if (
      first.error &&
      /trial_plan_sku|42703|column/i.test(first.error.message)
    ) {
      const second = await supabase
        .from('pharmacy_commercial_trials')
        .select(selectLegacy)
        .order('created_at', { ascending: false })
        .limit(200);
      data = second.data as unknown[] | null;
      error = second.error;
    } else {
      data = first.data as unknown[] | null;
      error = first.error;
    }
  }

  if (error) {
    console.error('[pilots] list', error.code, error.message);
    return { ok: false, error: 'No se han podido cargar los pilotos.' };
  }

  const pharmacyIds = (data ?? []).map(
    (r) => (r as { pharmacy_id: string }).pharmacy_id
  );
  const modeByPharmacy = new Map<string, 'generic' | 'own'>();
  const countByPharmacy = new Map<string, number>();
  const urlByPharmacy = new Map<string, string>();

  if (pharmacyIds.length > 0) {
    const [{ data: settings }, counts, { data: entrypoints }] =
      await Promise.all([
        supabase
          .from('pharmacy_settings')
          .select('pharmacy_id, catalog_mode')
          .in('pharmacy_id', pharmacyIds),
        // Misma clave que listPharmacyCatalogSummaries → 1 fetch por request.
        loadPharmacyProductCounts(ALL_PHARMACY_PRODUCTS_KEY),
        supabase
          .from('public_entrypoints')
          .select('pharmacy_id, public_id, purpose, is_active')
          .in('pharmacy_id', pharmacyIds)
          .eq('purpose', 'pharmacy_home')
          .eq('is_active', true),
      ]);

    for (const s of settings ?? []) {
      modeByPharmacy.set(
        s.pharmacy_id as string,
        s.catalog_mode === 'own' ? 'own' : 'generic'
      );
    }

    counts.genericCount.forEach((n, id) => {
      countByPharmacy.set(id, n);
    });

    for (const ep of entrypoints ?? []) {
      const pid = ep.pharmacy_id as string;
      const publicId = ep.public_id as string;
      if (pid && publicId) {
        urlByPharmacy.set(pid, pharmacyEntrypointPublicUrl(publicId));
      }
    }
  }

  const rows: CommercialPilotRow[] = (data ?? []).map((row) => {
    const raw = row as Record<string, unknown>;
    const ph = raw.pharmacies as unknown as {
      id: string;
      name: string;
      status: string;
    };
    const endsAt = (raw.ends_at as string | null) ?? null;
    const status = raw.status as CommercialTrialStatus;
    const pharmacyId = raw.pharmacy_id as string;
    const skuRaw =
      raw.trial_plan_sku == null
        ? null
        : String(raw.trial_plan_sku).toLowerCase();
    const trialPlanSku: PilotTrialPlanSku | null =
      skuRaw === 'general' ||
      skuRaw === 'personalized' ||
      skuRaw === 'ai_personalized'
        ? skuRaw
        : null;
    return {
      trialId: raw.id as string,
      pharmacyId,
      pharmacyName: ph?.name ?? '—',
      pharmacyStatus: ph?.status ?? '—',
      trialStatus: status,
      trialPlanSku,
      preparedAt: (raw.prepared_at as string | null) ?? null,
      activatedAt: (raw.activated_at as string | null) ?? null,
      endsAt,
      extensionUsed: Boolean(raw.extension_used),
      extendedAt: (raw.extended_at as string | null) ?? null,
      catalogMode: modeByPharmacy.get(pharmacyId) ?? 'generic',
      genericProductCount: countByPharmacy.get(pharmacyId) ?? 0,
      daysRemaining:
        status === 'active' || status === 'extended'
          ? daysRemaining(endsAt)
          : null,
      publicUrl: urlByPharmacy.get(pharmacyId) ?? null,
    };
  });

  const kpis: PilotKpis = {
    active: rows.filter((r) => r.trialStatus === 'active').length,
    expiringSoon: rows.filter(
      (r) =>
        (r.trialStatus === 'active' || r.trialStatus === 'extended') &&
        r.daysRemaining != null &&
        r.daysRemaining >= 0 &&
        r.daysRemaining <= 3
    ).length,
    ended: rows.filter((r) => r.trialStatus === 'ended').length,
    extended: rows.filter((r) => r.trialStatus === 'extended').length,
  };

  return { ok: true, rows, kpis };
}

export type ReadinessCheck = {
  key: string;
  ok: boolean;
  detail?: string;
  required?: string;
};

export type ReadinessResult =
  | {
      ok: true;
      ready: boolean;
      checks: ReadinessCheck[];
      minGeneric: number;
    }
  | { ok: false; error: string };

export async function fetchTrialReadiness(
  pharmacyId: string
): Promise<ReadinessResult> {
  const allowed = await canManageCommercialTrials();
  if (!allowed) {
    return { ok: false, error: 'Sin permiso para comprobar preparación.' };
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc('ff_commercial_trial_readiness_v1', {
    p_pharmacy_id: pharmacyId,
  });
  if (error) {
    console.error('[pilots] readiness', error.code, error.message);
    return {
      ok: false,
      error: 'No se ha podido comprobar la preparación del piloto.',
    };
  }
  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  if (!payload) {
    return { ok: false, error: 'Respuesta de preparación vacía.' };
  }
  const checksRaw = Array.isArray(payload.checks) ? payload.checks : [];
  const checks: ReadinessCheck[] = checksRaw.map((c) => {
    const row = c as Record<string, unknown>;
    return {
      key: String(row.key ?? ''),
      ok: Boolean(row.ok),
      detail: row.detail != null ? String(row.detail) : undefined,
      required: row.required != null ? String(row.required) : undefined,
    };
  });
  return {
    ok: true,
    ready: Boolean(payload.ready),
    checks,
    minGeneric: Number(payload.min_generic_products ?? payload.min_demo_products ?? 100),
  };
}
