import { createClient } from '@/lib/supabase/server';
import { requireConsultsView } from '@/lib/kiosk/assistant/consults/authz';
import type {
  PharmacistConsultStatus,
  PharmacistConsultSummary,
} from '@/lib/kiosk/assistant/consults/types';

function mapConsult(row: Record<string, unknown>): PharmacistConsultSummary {
  const channelRaw = String(row.channel ?? 'kiosk');
  const channel =
    channelRaw === 'customer_portal' ? 'customer_portal' : 'kiosk';
  return {
    id: String(row.id),
    pharmacyId: String(row.pharmacy_id),
    channel,
    displayCode: String(row.display_code),
    clientMessage: String(row.client_message),
    status: String(row.status) as PharmacistConsultStatus,
    pharmacistReply:
      row.pharmacist_reply == null ? null : String(row.pharmacist_reply),
    answeredAt: row.answered_at == null ? null : String(row.answered_at),
    resolvedAt: row.resolved_at == null ? null : String(row.resolved_at),
    expiresAt: String(row.expires_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listPharmacyAssistantConsults(
  pharmacyId: string,
  options?: { status?: PharmacistConsultStatus | 'all'; limit?: number }
): Promise<
  | { ok: true; consults: PharmacistConsultSummary[] }
  | { ok: false; error: string }
> {
  const auth = await requireConsultsView(pharmacyId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_pharmacy_assistant_list_consults_v1',
    {
      p_pharmacy_id: pharmacyId,
      p_status:
        !options?.status || options.status === 'all' ? null : options.status,
      p_limit: options?.limit ?? 50,
    }
  );

  if (error) {
    console.error('[assistant-consults] list', error.message);
    return { ok: false, error: 'No se han podido cargar las consultas.' };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  if (!payload || String(payload.status) !== 'ok') {
    if (String(payload?.status) === 'forbidden') {
      return { ok: false, error: 'No tienes permiso para ver estas consultas.' };
    }
    return { ok: false, error: 'No se han podido cargar las consultas.' };
  }

  const rows = Array.isArray(payload.consults) ? payload.consults : [];
  return {
    ok: true,
    consults: rows.map((r) => mapConsult(r as Record<string, unknown>)),
  };
}

export async function getPharmacyAssistantPendingConsultCount(
  pharmacyId: string
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const auth = await requireConsultsView(pharmacyId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const supabase = createClient();
  const { data, error } = await supabase.rpc(
    'ff_pharmacy_assistant_pending_consult_count_v1',
    { p_pharmacy_id: pharmacyId }
  );

  if (error) {
    console.error('[assistant-consults] pending count', error.message);
    return { ok: false, error: 'No se ha podido obtener el contador.' };
  }

  const payload =
    data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  if (!payload || String(payload.status) !== 'ok') {
    return { ok: false, error: 'No se ha podido obtener el contador.' };
  }

  return {
    ok: true,
    count: Math.max(0, Number(payload.pending_count) || 0),
  };
}
