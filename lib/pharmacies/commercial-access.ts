import { createClient } from '@/lib/supabase/server';
import {
  COMMERCIAL_PILOT_DURATION_DAYS,
} from '@/lib/commercial/pharmacy-onboarding';
import {
  resolvePharmacyCommercialAccess,
  type CommercialAccessMode,
  type CommercialPharmacyStatus,
  type CommercialSubscriptionStatus,
  type CommercialTrialSnapshot,
  type OperabilityReason,
  type OperabilityResult,
} from '@/lib/pharmacies/commercial-lifecycle';

export const FARMAFACIL_SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'soporte@farmafacil.solutions';

export type PharmacyCommercialGate = OperabilityResult & {
  pharmacyId: string;
  pharmacyName: string;
  pharmacyStatus: CommercialPharmacyStatus | string;
  subscriptionStatus: CommercialSubscriptionStatus | string | null;
  commercialReason: string | null;
  suspensionReason: string | null;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  gracePeriodEndsAt: string | null;
  accessMode: CommercialAccessMode;
  commercialTrial: CommercialTrialSnapshot | null;
  title: string;
  message: string;
};

const OPERABILITY_COPY: Record<
  OperabilityReason,
  { title: string; message: string }
> = {
  ok: {
    title: 'Acceso disponible',
    message: 'La farmacia tiene acceso operativo vigente.',
  },
  pharmacy_suspended: {
    title: 'Farmacia suspendida',
    message:
      'El acceso operativo de esta farmacia está suspendido. Los datos se conservan. Contacta con soporte para regularizar la situación.',
  },
  pharmacy_archived: {
    title: 'Farmacia archivada',
    message:
      'Esta farmacia está archivada y no admite operaciones. Contacta con soporte si necesitas reactivarla.',
  },
  subscription_paused: {
    title: 'Suscripción en pausa',
    message:
      'La suscripción de esta farmacia está en pausa. No se pueden usar el panel ni los módulos operativos.',
  },
  subscription_cancelled: {
    title: 'Suscripción cancelada',
    message:
      'La suscripción de esta farmacia está cancelada. El acceso operativo no está disponible.',
  },
  subscription_expired: {
    title: 'Suscripción expirada',
    message:
      'La suscripción de esta farmacia ha expirado. Contacta con soporte para contratar o reactivar el servicio.',
  },
  trial_ended: {
    title: 'Periodo de prueba finalizado',
    message:
      'El periodo de prueba ha terminado y no hay una suscripción contratada vigente. Contacta con soporte para activar un plan.',
  },
  period_ended_after_cancel: {
    title: 'Suscripción finalizada',
    message:
      'La cancelación programada ha llegado a su fecha de fin. El acceso operativo ya no está disponible.',
  },
  grace_ended: {
    title: 'Acceso bloqueado por impago',
    message:
      'El periodo de gracia por impago ha finalizado. Regulariza el pago con soporte para recuperar el acceso.',
  },
  no_valid_subscription: {
    title: 'Sin suscripción vigente',
    message:
      'No hay una suscripción comercial vigente para esta farmacia. Contacta con soporte FarmaFácil.',
  },
  pilot_ready_pending_activation: {
    title: 'Piloto pendiente de activación',
    message: `Tu farmacia tiene un piloto comercial preparado (${COMMERCIAL_PILOT_DURATION_DAYS} días disponibles, todavía no iniciados). FarmaFácil activará el piloto cuando se complete la preparación. Mientras tanto no hay acceso operativo (pedidos, catálogo editable ni módulos contratados).`,
  },
  pilot_expired: {
    title: 'Piloto comercial finalizado',
    message:
      'El periodo del piloto comercial ha terminado. El acceso operativo no está disponible. Contacta con soporte para continuar con un plan.',
  },
  pilot_ended: {
    title: 'Piloto comercial cerrado',
    message:
      'El piloto comercial de esta farmacia está cerrado. Contacta con soporte FarmaFácil para contratar o reactivar el servicio.',
  },
};

type SubRow = {
  status: string;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  grace_period_ends_at: string | null;
  commercial_reason: string | null;
};

type TrialRow = {
  status: string;
  prepared_at: string | null;
  activated_at: string | null;
  ends_at: string | null;
  program: string | null;
};

const TRIAL_SELECT =
  'status, prepared_at, activated_at, ends_at, program';

/**
 * Evalúa acceso comercial de una farmacia (piloto + suscripción).
 * Lectura vía RLS: member active o plataforma.
 * El piloto open prevalece sobre una suscripción legacy cancelada.
 */
export async function loadPharmacyCommercialGate(
  pharmacyId: string
): Promise<
  | { ok: true; gate: PharmacyCommercialGate }
  | { ok: false; reason: 'not_found' | 'error'; message?: string }
> {
  const supabase = createClient();

  const { data: pharmacy, error: pharmacyError } = await supabase
    .from('pharmacies')
    .select('id, name, status, suspension_reason')
    .eq('id', pharmacyId)
    .maybeSingle();

  if (pharmacyError) {
    // Columna suspension_reason puede no existir si 027 aún no está aplicada:
    // reintento mínimo sin esa columna.
    if (
      pharmacyError.message?.includes('suspension_reason') ||
      pharmacyError.code === '42703'
    ) {
      const fallback = await supabase
        .from('pharmacies')
        .select('id, name, status')
        .eq('id', pharmacyId)
        .maybeSingle();
      if (fallback.error || !fallback.data) {
        return {
          ok: false,
          reason: fallback.error ? 'error' : 'not_found',
          message: fallback.error?.message,
        };
      }
      const trial = await loadCommercialTrialForGate(pharmacyId);
      return buildGateFromRows(
        fallback.data as { id: string; name: string; status: string },
        null,
        null,
        trial
      );
    }
    console.error(
      '[commercial-access] pharmacy',
      pharmacyError.code,
      pharmacyError.message
    );
    return { ok: false, reason: 'error', message: pharmacyError.message };
  }

  if (!pharmacy) {
    return { ok: false, reason: 'not_found' };
  }

  const { data: subs, error: subError } = await supabase
    .from('subscriptions')
    .select(
      `
      status,
      trial_end,
      current_period_end,
      cancel_at_period_end,
      grace_period_ends_at,
      commercial_reason
    `
    )
    .eq('pharmacy_id', pharmacyId)
    .in('status', ['trialing', 'active', 'past_due', 'paused'])
    .order('updated_at', { ascending: false })
    .limit(1);

  let sub: SubRow | null = (subs?.[0] as SubRow | undefined) ?? null;

  if (subError) {
    // Compatibilidad pre-027: sin grace/commercial_reason
    if (
      subError.message?.includes('grace_period_ends_at') ||
      subError.message?.includes('commercial_reason') ||
      subError.code === '42703'
    ) {
      const legacy = await supabase
        .from('subscriptions')
        .select(
          'status, trial_end, current_period_end, cancel_at_period_end'
        )
        .eq('pharmacy_id', pharmacyId)
        .in('status', ['trialing', 'active', 'past_due', 'paused'])
        .order('updated_at', { ascending: false })
        .limit(1);
      const row = legacy.data?.[0] as
        | Omit<SubRow, 'grace_period_ends_at' | 'commercial_reason'>
        | undefined;
      sub = row
        ? {
            ...row,
            grace_period_ends_at: null,
            commercial_reason: null,
          }
        : null;
    } else {
      console.error(
        '[commercial-access] subscription',
        subError.code,
        subError.message
      );
      return { ok: false, reason: 'error', message: subError.message };
    }
  }

  const trial = await loadCommercialTrialForGate(pharmacyId);

  // Solo usar cancelled/expired para mensaje si NO hay piloto abierto.
  const openPilot =
    trial &&
    (trial.status === 'draft' ||
      trial.status === 'ready' ||
      trial.status === 'active' ||
      trial.status === 'extended');

  if (!sub && !openPilot) {
    const { data: ended } = await supabase
      .from('subscriptions')
      .select(
        'status, trial_end, current_period_end, cancel_at_period_end, grace_period_ends_at, commercial_reason'
      )
      .eq('pharmacy_id', pharmacyId)
      .in('status', ['cancelled', 'expired'])
      .order('updated_at', { ascending: false })
      .limit(1);
    sub = (ended?.[0] as SubRow | undefined) ?? null;
  }

  const suspensionReason =
    'suspension_reason' in pharmacy
      ? ((pharmacy as { suspension_reason?: string | null }).suspension_reason ??
        null)
      : null;

  return buildGateFromRows(
    pharmacy as { id: string; name: string; status: string },
    sub,
    suspensionReason,
    trial
  );
}

/**
 * Lee pharmacy_commercial_trials.
 * RLS actual: solo plataforma. Tras soft-lock de farmacia (member puede ver pharmacies),
 * usa admin solo para la fila del trial — no concede SELECT operativo.
 */
async function loadCommercialTrialForGate(
  pharmacyId: string
): Promise<CommercialTrialSnapshot | null> {
  const supabase = createClient();

  const open = await supabase
    .from('pharmacy_commercial_trials')
    .select(TRIAL_SELECT)
    .eq('pharmacy_id', pharmacyId)
    .in('status', ['draft', 'ready', 'active', 'extended'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (!open.error && open.data?.[0]) {
    return mapTrialRow(open.data[0] as TrialRow);
  }

  // Member JWT no ve trials → lectura acotada con service role.
  // Dynamic import: evita arrastrar @supabase/supabase-js al grafo RSC/webpack
  // de rutas tenant (crash «Cannot read properties of undefined (reading 'call')»
  // en /f/.../pedidos al resolver el gate comercial).
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const adminOpen = await admin
      .from('pharmacy_commercial_trials')
      .select(TRIAL_SELECT)
      .eq('pharmacy_id', pharmacyId)
      .in('status', ['draft', 'ready', 'active', 'extended'])
      .order('created_at', { ascending: false })
      .limit(1);
    if (adminOpen.data?.[0]) {
      return mapTrialRow(adminOpen.data[0] as TrialRow);
    }
    const adminAny = await admin
      .from('pharmacy_commercial_trials')
      .select(TRIAL_SELECT)
      .eq('pharmacy_id', pharmacyId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (adminAny.data?.[0]) {
      return mapTrialRow(adminAny.data[0] as TrialRow);
    }
  } catch (err) {
    console.error('[commercial-access] trial admin read', err);
  }

  return null;
}

function mapTrialRow(row: TrialRow): CommercialTrialSnapshot {
  return {
    status: row.status,
    preparedAt: row.prepared_at,
    activatedAt: row.activated_at,
    endsAt: row.ends_at,
    program: row.program,
  };
}

function buildGateFromRows(
  pharmacy: { id: string; name: string; status: string },
  sub: SubRow | null,
  suspensionReason: string | null,
  trial: CommercialTrialSnapshot | null
): { ok: true; gate: PharmacyCommercialGate } {
  const evaluation = resolvePharmacyCommercialAccess({
    pharmacyStatus: pharmacy.status as CommercialPharmacyStatus,
    subscriptionStatus: sub?.status ?? null,
    trialEnd: sub?.trial_end ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
    gracePeriodEndsAt: sub?.grace_period_ends_at ?? null,
    trial,
  });

  const copy = OPERABILITY_COPY[evaluation.reason];
  // No mezclar motivo de conversión legacy cancelada en pantalla de preparación.
  const detail =
    evaluation.accessMode === 'preparation'
      ? null
      : suspensionReason || sub?.commercial_reason || null;

  return {
    ok: true,
    gate: {
      ...evaluation,
      pharmacyId: pharmacy.id,
      pharmacyName: pharmacy.name,
      pharmacyStatus: pharmacy.status,
      subscriptionStatus: sub?.status ?? null,
      commercialReason: sub?.commercial_reason ?? null,
      suspensionReason,
      trialEnd: sub?.trial_end ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      gracePeriodEndsAt: sub?.grace_period_ends_at ?? null,
      commercialTrial: trial,
      title: copy.title,
      message: detail
        ? `${copy.message} Motivo registrado: ${detail}.`
        : copy.message,
    },
  };
}

/** Copia de soporte para UI (sin I/O). */
export function commercialSupportContact(): string {
  return FARMAFACIL_SUPPORT_EMAIL;
}
