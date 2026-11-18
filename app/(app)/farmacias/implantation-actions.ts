'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import {
  getCurrentProfile,
  hasPlatformPermission,
} from '@/lib/auth/platform';
import {
  IMPLANTATION_CONCEPTS,
  implantationPendingCents,
  type ImplantationConcept,
  type ImplantationPaymentRow,
} from '@/lib/commercial/implantation-payments';

type ActionResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

async function requireImplantationManage(): Promise<ActionResult> {
  const quotes = await hasPlatformPermission(
    'platform.commercial_quotes.manage'
  );
  const subs = await hasPlatformPermission('platform.subscriptions.manage');
  if (!quotes.ok && !subs.ok) {
    return {
      ok: false,
      error: 'Sin permiso para registrar implantaciones.',
    };
  }
  return { ok: true };
}

function mapRow(raw: Record<string, unknown>): ImplantationPaymentRow {
  return {
    id: String(raw.id),
    pharmacyId: String(raw.pharmacy_id),
    concept: raw.concept as ImplantationConcept,
    netCents: Number(raw.net_cents) || 0,
    taxCents: Number(raw.tax_cents) || 0,
    totalCents: Number(raw.total_cents) || 0,
    amountPaidCents: Number(raw.amount_paid_cents) || 0,
    appliedCents: Number(raw.applied_cents) || 0,
    appliedToQuoteId: (raw.applied_to_quote_id as string | null) ?? null,
    paymentStatus: String(raw.payment_status ?? 'recorded'),
    paymentDate: String(raw.payment_date ?? ''),
    documentRef: (raw.document_ref as string | null) ?? null,
  };
}

export async function listPharmacyImplantationPaymentsAction(
  pharmacyId: string
): Promise<ActionResult<{ payments: ImplantationPaymentRow[] }>> {
  const perm = await requireImplantationManage();
  if (!perm.ok) return perm;
  if (!pharmacyId) return { ok: false, error: 'Farmacia no válida.' };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_implantation_payments')
    .select(
      'id, pharmacy_id, concept, net_cents, tax_cents, total_cents, amount_paid_cents, applied_cents, applied_to_quote_id, payment_status, payment_date, document_ref'
    )
    .eq('pharmacy_id', pharmacyId)
    .order('payment_date', { ascending: false });

  if (error) {
    console.error('[implantation] list', error.message);
    return { ok: false, error: 'No se han podido cargar las implantaciones.' };
  }

  return {
    ok: true,
    payments: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
  };
}

export async function recordPharmacyImplantationPaymentAction(input: {
  pharmacyId: string;
  concept: ImplantationConcept;
  amountPaidCents?: number;
  paymentDate?: string;
  documentRef?: string | null;
  notes?: string | null;
  trialId?: string | null;
}): Promise<ActionResult<{ paymentId: string }>> {
  const perm = await requireImplantationManage();
  if (!perm.ok) return perm;

  const conceptDef = IMPLANTATION_CONCEPTS[input.concept];
  if (!conceptDef) {
    return { ok: false, error: 'Concepto de implantación no válido.' };
  }
  if (!input.pharmacyId) {
    return { ok: false, error: 'Farmacia no válida.' };
  }

  const netCents = conceptDef.defaultNetCents;
  const taxCents = Math.round(netCents * 0.21);
  const totalCents = netCents + taxCents;
  const amountPaidCents =
    typeof input.amountPaidCents === 'number' && input.amountPaidCents >= 0
      ? Math.round(input.amountPaidCents)
      : totalCents;

  const profile = await getCurrentProfile();
  const by = profile.profile?.id ?? null;
  const supabase = createClient();

  const { data, error } = await supabase
    .from('pharmacy_implantation_payments')
    .insert({
      pharmacy_id: input.pharmacyId,
      trial_id: input.trialId ?? null,
      concept: input.concept,
      net_cents: netCents,
      tax_cents: taxCents,
      total_cents: totalCents,
      amount_paid_cents: amountPaidCents,
      payment_date: input.paymentDate?.trim() || new Date().toISOString().slice(0, 10),
      payment_status: 'recorded',
      document_ref: input.documentRef?.trim() || null,
      notes: input.notes?.trim() || null,
      recorded_by: by,
    })
    .select('id')
    .maybeSingle();

  if (error || !data) {
    console.error('[implantation] insert', error?.message);
    return { ok: false, error: 'No se ha podido registrar el pago de implantación.' };
  }

  revalidatePath(`/farmacias/${input.pharmacyId}`);
  revalidatePath('/tarifas');
  return { ok: true, paymentId: data.id as string };
}

/** Pagos con saldo pendiente de compensar (para presupuestos). */
export async function getPendingImplantationCompensationAction(
  pharmacyId: string
): Promise<
  ActionResult<{
    pending: Array<{
      id: string;
      concept: ImplantationConcept;
      label: string;
      pendingCents: number;
    }>;
    totalPendingCents: number;
  }>
> {
  const list = await listPharmacyImplantationPaymentsAction(pharmacyId);
  if (!list.ok) return list;

  const pending = list.payments
    .filter(
      (p) =>
        p.paymentStatus !== 'void' &&
        p.paymentStatus !== 'refunded' &&
        implantationPendingCents(p) > 0
    )
    .map((p) => ({
      id: p.id,
      concept: p.concept,
      label: IMPLANTATION_CONCEPTS[p.concept]?.label ?? p.concept,
      pendingCents: implantationPendingCents(p),
    }));

  return {
    ok: true,
    pending,
    totalPendingCents: pending.reduce((s, p) => s + p.pendingCents, 0),
  };
}
