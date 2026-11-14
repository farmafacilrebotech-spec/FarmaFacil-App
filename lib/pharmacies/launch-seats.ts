/**
 * Plazas promoción lanzamiento 2027 — única fuente de verdad:
 * commercial_launch_cohort_counters + commercial_launch_seat_reservations (+ events 089).
 */

import { createClient } from '@/lib/supabase/server';
import {
  LAUNCH_2027_MAX_SLOTS,
  formatEurFromCents,
  type PaidCommercialSku,
} from '@/lib/pharmacies/commercial-assign-pricing';
import { commercialPlanLabel } from '@/lib/commercial/commercial-plan-labels';

export const LAUNCH_2027_COHORT = 'launch_2027' as const;

export type LaunchSeatStatus =
  | 'none'
  | 'reserved'
  | 'confirmed'
  | 'released'
  | 'expired';

export type LaunchSeatsSummary = {
  cohortKey: typeof LAUNCH_2027_COHORT;
  maxSlots: number;
  usedSlots: number;
  remaining: number;
  reservedCount: number;
  confirmedCount: number;
  pharmacyHasActiveSeat: boolean;
};

export type LaunchSeatDetail = {
  reservationId: string;
  pharmacyId: string;
  pharmacyName: string | null;
  pharmacyStatus: string | null;
  status: LaunchSeatStatus;
  rawStatus: 'active' | 'released' | 'expired';
  commercialSkuKey: string;
  planLabel: string;
  listMonthlyCents: number;
  promoMonthlyCents: number;
  listMonthlyLabel: string;
  promoMonthlyLabel: string;
  discountLabel: string;
  reservedAt: string;
  reservedById: string | null;
  reservedByLabel: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
  confirmedAt: string | null;
  commitmentKind: string | null;
  commitmentNotes: string | null;
  expiresAt: string | null;
  canRelease: boolean;
  canExtend: boolean;
  releaseBlockReason: string | null;
};

export type LaunchSeatEvent = {
  id: string;
  pharmacyId: string;
  pharmacyName: string | null;
  eventType: string;
  actorLabel: string | null;
  reason: string | null;
  commercialSkuKey: string | null;
  createdAt: string;
};

export type LaunchPromoDashboard = {
  summary: LaunchSeatsSummary;
  seats: LaunchSeatDetail[];
  events: LaunchSeatEvent[];
};

function skuLabel(sku: string): string {
  try {
    return commercialPlanLabel(sku);
  } catch {
    return sku;
  }
}

export {
  launchPromoEconomyForSku,
  launchSeatEventLabelEs,
} from '@/lib/pharmacies/launch-seats-ui';

function mapSeatRow(
  row: Record<string, unknown>,
  pharmacyName?: string | null,
  pharmacyStatus?: string | null,
  reservedByLabel?: string | null
): LaunchSeatDetail {
  const rawStatus = String(row.status ?? '') as
    | 'active'
    | 'released'
    | 'expired';
  const confirmedAt =
    typeof row.confirmed_at === 'string' ? row.confirmed_at : null;
  const commitmentKind =
    typeof row.commitment_kind === 'string' ? row.commitment_kind : null;
  const expiresAt =
    typeof row.expires_at === 'string' ? row.expires_at : null;
  const list = Number(row.list_monthly_cents ?? 0);
  const promo = Number(row.promo_monthly_cents ?? 0);
  const discountPct =
    list > 0 ? Math.round(((list - promo) / list) * 100) : 0;

  let status: LaunchSeatStatus = 'none';
  if (rawStatus === 'released') status = 'released';
  else if (rawStatus === 'expired') status = 'expired';
  else if (rawStatus === 'active' && (confirmedAt || commitmentKind))
    status = 'confirmed';
  else if (rawStatus === 'active') status = 'reserved';

  let canRelease = rawStatus === 'active' && !confirmedAt && !commitmentKind;
  let canExtend = canRelease;
  let releaseBlockReason: string | null = null;
  if (rawStatus === 'active' && (confirmedAt || commitmentKind)) {
    canRelease = false;
    canExtend = false;
    releaseBlockReason =
      'Plaza confirmada o con compromiso (contrato / factura / descuento bloqueado). Liberación simple no permitida: contacte jurídico/comercial.';
  }

  const sku = String(row.commercial_sku_key ?? '');

  return {
    reservationId: String(row.id),
    pharmacyId: String(row.pharmacy_id),
    pharmacyName: pharmacyName ?? null,
    pharmacyStatus: pharmacyStatus ?? null,
    status,
    rawStatus,
    commercialSkuKey: sku,
    planLabel: skuLabel(sku),
    listMonthlyCents: list,
    promoMonthlyCents: promo,
    listMonthlyLabel: formatEurFromCents(list),
    promoMonthlyLabel: formatEurFromCents(promo),
    discountLabel: discountPct > 0 ? `−${discountPct} % sobre lista` : '—',
    reservedAt: String(row.reserved_at ?? ''),
    reservedById:
      row.reserved_by == null ? null : String(row.reserved_by),
    reservedByLabel: reservedByLabel ?? null,
    releasedAt:
      typeof row.released_at === 'string' ? row.released_at : null,
    releaseReason:
      typeof row.release_reason === 'string' ? row.release_reason : null,
    confirmedAt,
    commitmentKind,
    commitmentNotes:
      typeof row.commitment_notes === 'string' ? row.commitment_notes : null,
    expiresAt,
    canRelease,
    canExtend,
    releaseBlockReason,
  };
}

export async function getLaunch2027SeatsSummary(
  pharmacyId?: string | null
): Promise<LaunchSeatsSummary> {
  const supabase = createClient();
  const { data: counter } = await supabase
    .from('commercial_launch_cohort_counters')
    .select('max_slots, used_slots')
    .eq('cohort_key', LAUNCH_2027_COHORT)
    .maybeSingle();

  const maxSlots = counter?.max_slots ?? LAUNCH_2027_MAX_SLOTS;
  const usedSlots = counter?.used_slots ?? 0;

  const { data: activeRows } = await supabase
    .from('commercial_launch_seat_reservations')
    .select('id, pharmacy_id, confirmed_at, commitment_kind, status')
    .eq('cohort_key', LAUNCH_2027_COHORT)
    .eq('status', 'active');

  const actives = (activeRows as Record<string, unknown>[] | null) ?? [];
  let reservedCount = 0;
  let confirmedCount = 0;
  let pharmacyHasActiveSeat = false;

  for (const r of actives) {
    const committed = Boolean(r.confirmed_at || r.commitment_kind);
    if (committed) confirmedCount += 1;
    else reservedCount += 1;
    if (pharmacyId && String(r.pharmacy_id) === pharmacyId) {
      pharmacyHasActiveSeat = true;
    }
  }

  return {
    cohortKey: LAUNCH_2027_COHORT,
    maxSlots,
    usedSlots,
    remaining: Math.max(maxSlots - usedSlots, 0),
    reservedCount,
    confirmedCount,
    pharmacyHasActiveSeat,
  };
}

export async function getPharmacyLaunchSeatDetail(
  pharmacyId: string
): Promise<LaunchSeatDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('commercial_launch_seat_reservations')
    .select(
      `
      id, pharmacy_id, commercial_sku_key, list_monthly_cents, promo_monthly_cents,
      status, reserved_at, reserved_by, released_at, release_reason,
      confirmed_at, confirmed_by, commitment_kind, commitment_notes, expires_at,
      pharmacies ( name, status ),
      profiles:reserved_by ( email, full_name )
    `
    )
    .eq('cohort_key', LAUNCH_2027_COHORT)
    .eq('pharmacy_id', pharmacyId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      // Fallback without joins if 089 cols missing on staging pre-migration
      const { data: basic } = await supabase
        .from('commercial_launch_seat_reservations')
        .select('*')
        .eq('cohort_key', LAUNCH_2027_COHORT)
        .eq('pharmacy_id', pharmacyId)
        .maybeSingle();
      if (!basic) return null;
      const basicRow = basic as Record<string, unknown>;
      const byId =
        basicRow.reserved_by == null ? null : String(basicRow.reserved_by);
      let label: string | null = null;
      if (byId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', byId)
          .maybeSingle();
        label =
          (prof?.full_name as string | null)?.trim() ||
          (prof?.email as string | null)?.trim() ||
          byId.slice(0, 8);
      }
      return mapSeatRow(basicRow, null, null, label);
    }
    return null;
  }

  const row = data as Record<string, unknown>;
  const ph = row.pharmacies as { name?: string; status?: string } | null;
  const pr = row.profiles as { email?: string; full_name?: string } | null;
  let label =
    pr?.full_name?.trim() ||
    pr?.email?.trim() ||
    null;
  if (!label && row.reserved_by) {
    const byId = String(row.reserved_by);
    const { data: prof } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', byId)
      .maybeSingle();
    label =
      (prof?.full_name as string | null)?.trim() ||
      (prof?.email as string | null)?.trim() ||
      byId.slice(0, 8);
  }

  return mapSeatRow(row, ph?.name ?? null, ph?.status ?? null, label);
}

export async function listLaunchSeatReservations(): Promise<LaunchSeatDetail[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('commercial_launch_seat_reservations')
    .select(
      `
      id, pharmacy_id, commercial_sku_key, list_monthly_cents, promo_monthly_cents,
      status, reserved_at, reserved_by, released_at, release_reason,
      confirmed_at, confirmed_by, commitment_kind, commitment_notes, expires_at,
      pharmacies ( name, status ),
      profiles:reserved_by ( email, full_name )
    `
    )
    .eq('cohort_key', LAUNCH_2027_COHORT)
    .order('reserved_at', { ascending: false });

  if (error) {
    console.error('[launch-seats] list', error.code, error.message);
    const { data: basic } = await supabase
      .from('commercial_launch_seat_reservations')
      .select('*')
      .eq('cohort_key', LAUNCH_2027_COHORT)
      .order('reserved_at', { ascending: false });
    return ((basic as Record<string, unknown>[] | null) ?? []).map((r) =>
      mapSeatRow(r)
    );
  }

  return ((data as Record<string, unknown>[] | null) ?? []).map((row) => {
    const ph = row.pharmacies as { name?: string; status?: string } | null;
    const pr = row.profiles as { email?: string; full_name?: string } | null;
    const label =
      pr?.full_name?.trim() ||
      pr?.email?.trim() ||
      (row.reserved_by ? String(row.reserved_by).slice(0, 8) : null);
    return mapSeatRow(row, ph?.name ?? null, ph?.status ?? null, label);
  });
}

export async function listLaunchSeatEvents(
  limit = 50,
  pharmacyId?: string
): Promise<LaunchSeatEvent[]> {
  const supabase = createClient();
  let q = supabase
    .from('commercial_launch_seat_events')
    .select(
      `
      id, pharmacy_id, event_type, reason, commercial_sku_key, created_at, actor_id,
      pharmacies ( name ),
      profiles:actor_id ( email, full_name )
    `
    )
    .eq('cohort_key', LAUNCH_2027_COHORT)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (pharmacyId) q = q.eq('pharmacy_id', pharmacyId);

  const { data, error } = await q;
  if (error) {
    // Tabla 089 aún no aplicada
    return [];
  }

  return ((data as Record<string, unknown>[] | null) ?? []).map((row) => {
    const ph = row.pharmacies as { name?: string } | null;
    const pr = row.profiles as { email?: string; full_name?: string } | null;
    return {
      id: String(row.id),
      pharmacyId: String(row.pharmacy_id),
      pharmacyName: ph?.name ?? null,
      eventType: String(row.event_type ?? ''),
      actorLabel:
        pr?.full_name?.trim() ||
        pr?.email?.trim() ||
        (row.actor_id ? String(row.actor_id).slice(0, 8) : null),
      reason: typeof row.reason === 'string' ? row.reason : null,
      commercialSkuKey:
        typeof row.commercial_sku_key === 'string'
          ? row.commercial_sku_key
          : null,
      createdAt: String(row.created_at ?? ''),
    };
  });
}

export async function getLaunchPromoDashboard(): Promise<LaunchPromoDashboard> {
  const [summary, seats, events] = await Promise.all([
    getLaunch2027SeatsSummary(),
    listLaunchSeatReservations(),
    listLaunchSeatEvents(80),
  ]);
  return { summary, seats, events };
}

export function paidSkusForReserve(): PaidCommercialSku[] {
  return ['general', 'personalized', 'ai_personalized'];
}
