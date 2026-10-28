import { createClient } from '@/lib/supabase/server';
import { requireOrdersView } from '@/lib/orders/authz';
import type { QuoteEventType } from '@/lib/orders/quote-event-labels';

export type { QuoteEventType } from '@/lib/orders/quote-event-labels';
export {
  QUOTE_EVENT_TYPES,
  QUOTE_EVENT_TYPE_LABELS,
} from '@/lib/orders/quote-event-labels';

/**
 * Historial append-only de presupuesto public_qr (tabla 062).
 * Soft-fail si la migración aún no está aplicada.
 */

export type PharmacyOrderQuoteEvent = {
  id: string;
  pharmacyId: string;
  orderId: string;
  quoteVersion: number;
  eventType: QuoteEventType | string;
  decision: 'accepted' | 'rejected' | null;
  totalAmount: number | null;
  createdAt: string;
};

type EventRow = {
  id: string;
  pharmacy_id: string;
  order_id: string;
  quote_version: number;
  event_type: string;
  decision: string | null;
  total_amount: number | string | null;
  created_at: string;
};

function mapEvent(row: EventRow): PharmacyOrderQuoteEvent {
  const decision =
    row.decision === 'accepted' || row.decision === 'rejected'
      ? row.decision
      : null;
  const total =
    row.total_amount == null
      ? null
      : typeof row.total_amount === 'string'
        ? Number(row.total_amount)
        : row.total_amount;
  return {
    id: row.id,
    pharmacyId: row.pharmacy_id,
    orderId: row.order_id,
    quoteVersion: Number(row.quote_version) || 0,
    eventType: row.event_type,
    decision,
    totalAmount: Number.isFinite(total as number) ? (total as number) : null,
    createdAt: row.created_at,
  };
}

function isMissingEventsTable(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('pharmacy_order_quote_events') ||
    (m.includes('relation') && m.includes('does not exist')) ||
    (m.includes('could not find') && m.includes('quote_events'))
  );
}

export async function listPharmacyOrderQuoteEvents(input: {
  pharmacyId: string;
  orderId: string;
  limit?: number;
}): Promise<
  | { ok: true; events: PharmacyOrderQuoteEvent[]; available: boolean }
  | { ok: false; error: string }
> {
  const auth = await requireOrdersView(input.pharmacyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  if (!input.orderId || !/^[0-9a-f-]{36}$/i.test(input.orderId)) {
    return { ok: false, error: 'Pedido no válido.' };
  }

  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_order_quote_events')
    .select(
      'id, pharmacy_id, order_id, quote_version, event_type, decision, total_amount, created_at'
    )
    .eq('pharmacy_id', input.pharmacyId)
    .eq('order_id', input.orderId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingEventsTable(error.message)) {
      return { ok: true, events: [], available: false };
    }
    console.error('[orders] quote events', error.message.slice(0, 160));
    return { ok: false, error: 'No se ha podido cargar el historial.' };
  }

  return {
    ok: true,
    available: true,
    events: ((data as EventRow[] | null) ?? []).map(mapEvent),
  };
}
