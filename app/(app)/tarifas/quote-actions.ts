'use server';

import { createHash } from 'node:crypto';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import {
  getCurrentProfile,
  hasPlatformPermission,
} from '@/lib/auth/platform';
import {
  buildCommercialQuoteLines,
  buildCommercialQuoteSnapshot,
  buildQuoteBreakdown,
  buildQuoteDocumentHtml,
  defaultValidUntilIso,
} from '@/lib/commercial/quote-document';
import {
  buildCommercialQuotePdf,
  pdfBytesToBase64,
} from '@/lib/commercial/quote-pdf';
import {
  appendEmailSend,
  appendStatusHistory,
  canTransitionQuoteStatus,
  parseQuoteInternalMeta,
  serializeQuoteInternalMeta,
} from '@/lib/commercial/quote-meta';
import { resolveCurrentTariffVersionId } from '@/lib/commercial/quote-queries';
import {
  COMMERCIAL_QUOTE_STATUSES,
  type CommercialQuoteSnapshot,
  type CommercialQuoteStatus,
} from '@/lib/commercial/quote-types';
import {
  type BillingInterval,
  type CommercialPlanId,
  type CommercialTariffConfig,
  type SaasCohortPricing,
} from '@/lib/tarifas';
import { loadTariffConfigForSession } from '@/lib/commercial/tariff-queries';
import { sendTransactionalEmail } from '@/lib/email/send';
import { buildCommercialQuoteEmailBodies } from '@/lib/email/commercial-quote-email';

export type QuoteActionResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; code?: string };

function revalidateQuotes() {
  revalidatePath('/tarifas');
}

async function requireQuotesManage(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const r = await hasPlatformPermission('platform.commercial_quotes.manage');
  if (!r.ok) {
    return {
      ok: false,
      error: 'Sin permiso para gestionar presupuestos comerciales.',
    };
  }
  return { ok: true };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function makeReferenceCode(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FF-PRE-${y}${m}${day}-${rand}`;
}

export async function getCommercialEmailSendReadiness(): Promise<{
  canSend: boolean;
  missing: string[];
  fromConfigured: string | null;
}> {
  const missing: string[] = [];
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) missing.push('RESEND_API_KEY');

  // Solo remitente realmente configurado. No inventar onboarding@resend.dev.
  const from = process.env.EMAIL_FROM?.trim() || null;
  if (!from) missing.push('EMAIL_FROM');

  return {
    canSend: missing.length === 0,
    missing,
    fromConfigured: missing.length === 0 ? from : null,
  };
}

export async function saveCommercialQuoteAction(input: {
  pharmacyId?: string | null;
  pharmacyName?: string | null;
  clientName: string;
  contactName: string;
  contactEmail: string;
  planId: CommercialPlanId;
  interval: BillingInterval;
  cohortPricing: SaasCohortPricing;
  kioskCount: number;
  onsiteInstallIncluded: boolean;
  notes?: string | null;
  validUntil?: string | null;
}): Promise<QuoteActionResult<{ quoteId: string; referenceCode: string }>> {
  const perm = await requireQuotesManage();
  if (!perm.ok) return perm;

  const clientName = input.clientName.trim();
  const contactName = input.contactName.trim();
  const contactEmail = input.contactEmail.trim().toLowerCase();
  const pharmacyId = input.pharmacyId?.trim() || null;

  if (!clientName && !pharmacyId) {
    return {
      ok: false,
      error: 'Indica una farmacia o el nombre del cliente potencial.',
    };
  }
  if (!contactName) {
    return { ok: false, error: 'Indica la persona de contacto.' };
  }
  if (!contactEmail || !isValidEmail(contactEmail)) {
    return { ok: false, error: 'Indica un email de contacto válido.' };
  }
  if (input.planId === 'pilot') {
    return {
      ok: false,
      error:
        'El piloto de 15 días no se guarda como presupuesto de contratación. Actívalo solo desde Gestión de pilotos.',
    };
  }

  const profile = await getCurrentProfile();
  const createdBy = profile.profile?.id ?? null;

  const tariffLoad = await loadTariffConfigForSession();
  const config: CommercialTariffConfig = tariffLoad.config;
  const tariffVersionId = await resolveCurrentTariffVersionId();
  if (!tariffVersionId) {
    return {
      ok: false,
      error: 'No hay una versión de tarifa vigente para asociar el presupuesto.',
    };
  }

  const pharmacyName = input.pharmacyName?.trim() || null;
  const resolvedClientName = clientName || pharmacyName || 'Cliente';

  const docInput = {
    config,
    clientName: resolvedClientName,
    contactName,
    contactEmail,
    pharmacyId,
    pharmacyName,
    planId: input.planId,
    interval: input.interval,
    cohortPricing: input.cohortPricing,
    kioskCount: input.kioskCount,
    onsiteInstallIncluded: input.onsiteInstallIncluded,
    notes: input.notes ?? null,
    validUntil: input.validUntil?.trim() || defaultValidUntilIso(),
  };

  const breakdown = buildQuoteBreakdown(docInput);
  const snapshot = buildCommercialQuoteSnapshot(docInput, breakdown);
  const lines = buildCommercialQuoteLines(snapshot);
  const referenceCode = makeReferenceCode();

  const meta = appendStatusHistory(
    { v: 1, history: [], emailSends: [] },
    {
      at: new Date().toISOString(),
      from: null,
      to: 'draft',
      by: createdBy,
      note: 'Presupuesto creado desde el simulador',
    }
  );

  const supabase = createClient();
  const { data: inserted, error } = await supabase
    .from('commercial_quotes')
    .insert({
      reference_code: referenceCode,
      status: 'draft',
      prospect_name: resolvedClientName,
      pharmacy_id: pharmacyId,
      commercial_sku_key: input.planId,
      billing_interval: input.interval,
      kiosk_count: breakdown.kioskCount,
      tariff_version_id: tariffVersionId,
      snapshot,
      one_time_net_cents: breakdown.oneTimeNetCents,
      one_time_vat_cents: breakdown.oneTimeVatCents,
      one_time_gross_cents: breakdown.oneTimeGrossCents,
      recurring_net_cents: breakdown.recurringNetCents,
      recurring_vat_cents: breakdown.recurringVatCents,
      recurring_gross_cents: breakdown.recurringGrossCents,
      first_year_net_cents: breakdown.firstYearNetCents,
      first_year_vat_cents: breakdown.firstYearVatCents,
      first_year_gross_cents: breakdown.firstYearGrossCents,
      currency: 'EUR',
      valid_until: snapshot.validUntil,
      notes: snapshot.notes,
      internal_notes: serializeQuoteInternalMeta(meta),
      created_by: createdBy,
      updated_by: createdBy,
    })
    .select('id')
    .maybeSingle();

  if (error || !inserted?.id) {
    console.error('[commercial-quotes] insert', error?.code, error?.message);
    return {
      ok: false,
      error: 'No se ha podido guardar el presupuesto.',
    };
  }

  if (lines.length > 0) {
    const { error: linesError } = await supabase
      .from('commercial_quote_lines')
      .insert(
        lines.map((l) => ({
          quote_id: inserted.id,
          line_type: l.lineType,
          description: l.description,
          quantity: l.quantity,
          unit_cents: l.unitCents,
          line_net_cents: l.lineNetCents,
          sort_order: l.sortOrder,
          metadata: l.metadata ?? {},
        }))
      );
    if (linesError) {
      console.error(
        '[commercial-quotes] lines',
        linesError.code,
        linesError.message
      );
      // Presupuesto ya creado; las líneas son auxiliares para PDF (snapshot basta).
    }
  }

  revalidateQuotes();
  return { ok: true, quoteId: inserted.id as string, referenceCode };
}

export async function updateCommercialQuoteStatusAction(input: {
  quoteId: string;
  status: CommercialQuoteStatus;
  note?: string | null;
}): Promise<QuoteActionResult<{ status: CommercialQuoteStatus }>> {
  const perm = await requireQuotesManage();
  if (!perm.ok) return perm;

  if (!COMMERCIAL_QUOTE_STATUSES.includes(input.status)) {
    return { ok: false, error: 'Estado no válido.' };
  }

  const supabase = createClient();
  const { data: row, error } = await supabase
    .from('commercial_quotes')
    .select('id, status, internal_notes')
    .eq('id', input.quoteId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: 'Presupuesto no encontrado.' };
  }

  const from = row.status as CommercialQuoteStatus;
  const to = input.status;
  if (!canTransitionQuoteStatus(from, to)) {
    return {
      ok: false,
      error: `No se puede pasar de ${from} a ${to}.`,
    };
  }

  const profile = await getCurrentProfile();
  const by = profile.profile?.id ?? null;
  const meta = appendStatusHistory(
    parseQuoteInternalMeta(row.internal_notes as string | null),
    {
      at: new Date().toISOString(),
      from,
      to,
      by,
      note: input.note?.trim() || null,
    }
  );

  const { error: updError } = await supabase
    .from('commercial_quotes')
    .update({
      status: to,
      internal_notes: serializeQuoteInternalMeta(meta),
      updated_by: by,
    })
    .eq('id', input.quoteId);

  if (updError) {
    console.error('[commercial-quotes] status', updError.code, updError.message);
    return { ok: false, error: 'No se ha podido actualizar el estado.' };
  }

  revalidateQuotes();
  return { ok: true, status: to };
}

export async function getCommercialQuoteDocumentAction(
  quoteId: string
): Promise<
  QuoteActionResult<{
    pdfBase64: string;
    filename: string;
    referenceCode: string;
    mimeType: 'application/pdf';
  }>
> {
  const perm = await requireQuotesManage();
  if (!perm.ok) return perm;

  const supabase = createClient();
  const { data: row, error } = await supabase
    .from('commercial_quotes')
    .select('id, reference_code, created_at, snapshot, internal_notes')
    .eq('id', quoteId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: 'Presupuesto no encontrado.' };
  }

  const snapshot = row.snapshot as CommercialQuoteSnapshot | null;
  if (!snapshot || snapshot.v !== 1) {
    return { ok: false, error: 'El presupuesto no tiene snapshot válido.' };
  }

  const referenceCode =
    (row.reference_code as string | null) ?? quoteId.slice(0, 8);
  const pdf = await buildCommercialQuotePdf({
    referenceCode,
    createdAt: row.created_at as string,
    snapshot,
  });

  const sha256 = createHash('sha256').update(pdf.bytes).digest('hex');
  const profile = await getCurrentProfile();
  const by = profile.profile?.id ?? null;
  const storagePath = `commercial-quotes/${quoteId}/${pdf.filename}`;

  const { error: uploadError } = await supabase.storage
    .from('email-attachments')
    .upload(storagePath, Buffer.from(pdf.bytes), {
      contentType: 'application/pdf',
      upsert: true,
    });

  let meta = parseQuoteInternalMeta(row.internal_notes as string | null);
  meta = {
    ...meta,
    pdfDocument: {
      filename: pdf.filename,
      storagePath: uploadError ? null : storagePath,
      sha256,
      generatedAt: new Date().toISOString(),
      generatedBy: by,
    },
  };
  await supabase
    .from('commercial_quotes')
    .update({
      internal_notes: serializeQuoteInternalMeta(meta),
      updated_by: by,
    })
    .eq('id', quoteId);

  if (uploadError) {
    console.warn(
      '[commercial-quotes] pdf storage',
      uploadError.message
    );
  } else {
    await supabase.from('commercial_quote_documents').insert({
      quote_id: quoteId,
      filename: pdf.filename,
      storage_path: storagePath,
      content_sha256: sha256,
      byte_size: pdf.bytes.byteLength,
      mime_type: 'application/pdf',
      created_by: by,
    });
  }

  return {
    ok: true,
    pdfBase64: pdfBytesToBase64(pdf.bytes),
    filename: pdf.filename,
    referenceCode,
    mimeType: 'application/pdf',
  };
}

/**
 * HTML corporativo PRE-05 (plantilla aprobada) para imprimir / descargar.
 * Logo oficial incrustado en servidor; importes desde el snapshot guardado.
 */
export async function getCommercialQuoteHtmlAction(
  quoteId: string
): Promise<
  QuoteActionResult<{
    html: string;
    filename: string;
    referenceCode: string;
  }>
> {
  const perm = await requireQuotesManage();
  if (!perm.ok) return perm;

  const supabase = createClient();
  const { data: row, error } = await supabase
    .from('commercial_quotes')
    .select('id, reference_code, created_at, snapshot')
    .eq('id', quoteId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: 'Presupuesto no encontrado.' };
  }
  const snapshot = row.snapshot as CommercialQuoteSnapshot | null;
  if (!snapshot || snapshot.v !== 1) {
    return { ok: false, error: 'El presupuesto no tiene snapshot válido.' };
  }

  const referenceCode =
    (row.reference_code as string | null) ?? quoteId.slice(0, 8);
  const html = buildQuoteDocumentHtml({
    referenceCode,
    createdAt: row.created_at as string,
    snapshot,
  });
  return {
    ok: true,
    html,
    filename: `presupuesto-${referenceCode}.html`,
    referenceCode,
  };
}

/**
 * Envía el presupuesto por email tras confirmación en UI.
 * Requiere RESEND_API_KEY y remitente corporativo. No usa fallback Resend.
 */
export async function sendCommercialQuoteEmailAction(input: {
  quoteId: string;
  confirmed: boolean;
}): Promise<
  QuoteActionResult<{
    emailStatus: 'sent' | 'failed' | 'not_configured';
    to: string;
  }>
> {
  const perm = await requireQuotesManage();
  if (!perm.ok) return perm;

  if (!input.confirmed) {
    return {
      ok: false,
      error: 'Debes confirmar el envío antes de mandar el email.',
      code: 'confirmation_required',
    };
  }

  const readiness = await getCommercialEmailSendReadiness();
  const supabase = createClient();
  const { data: row, error } = await supabase
    .from('commercial_quotes')
    .select(
      'id, reference_code, status, snapshot, internal_notes, prospect_name, created_at'
    )
    .eq('id', input.quoteId)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: 'Presupuesto no encontrado.' };
  }

  const snapshot = row.snapshot as CommercialQuoteSnapshot | null;
  if (!snapshot || snapshot.v !== 1) {
    return { ok: false, error: 'Snapshot inválido.' };
  }

  const to = snapshot.contactEmail?.trim().toLowerCase();
  if (!to || !isValidEmail(to)) {
    return {
      ok: false,
      error: 'El presupuesto no tiene un email de contacto válido.',
    };
  }

  const profile = await getCurrentProfile();
  const by = profile.profile?.id ?? null;
  let meta = parseQuoteInternalMeta(row.internal_notes as string | null);
  const referenceCode =
    (row.reference_code as string | null) ?? input.quoteId.slice(0, 8);

  if (!readiness.canSend) {
    meta = appendEmailSend(meta, {
      at: new Date().toISOString(),
      to,
      status: 'not_configured',
      error: `Falta configuración: ${readiness.missing.join(', ')}`,
      by,
    });
    await supabase
      .from('commercial_quotes')
      .update({
        internal_notes: serializeQuoteInternalMeta(meta),
        updated_by: by,
      })
      .eq('id', input.quoteId);
    revalidateQuotes();
    return {
      ok: false,
      code: 'not_configured',
      error: `El envío no está habilitado. Falta: ${readiness.missing.join(', ')}. La descarga del presupuesto sí está disponible.`,
    };
  }

  const pdf = await buildCommercialQuotePdf({
    referenceCode,
    createdAt: row.created_at as string,
    snapshot,
  });
  const sha256 = createHash('sha256').update(pdf.bytes).digest('hex');
  const storagePath = `commercial-quotes/${input.quoteId}/${pdf.filename}`;
  const { error: uploadError } = await supabase.storage
    .from('email-attachments')
    .upload(storagePath, Buffer.from(pdf.bytes), {
      contentType: 'application/pdf',
      upsert: true,
    });
  meta = {
    ...meta,
    pdfDocument: {
      filename: pdf.filename,
      storagePath: uploadError ? null : storagePath,
      sha256,
      generatedAt: new Date().toISOString(),
      generatedBy: by,
    },
  };
  if (!uploadError) {
    await supabase.from('commercial_quote_documents').insert({
      quote_id: input.quoteId,
      filename: pdf.filename,
      storage_path: storagePath,
      content_sha256: sha256,
      byte_size: pdf.bytes.byteLength,
      mime_type: 'application/pdf',
      created_by: by,
    });
  }

  const bodies = buildCommercialQuoteEmailBodies({
    referenceCode,
    contactName: snapshot.contactName,
    clientName: snapshot.clientName,
    validUntil: snapshot.validUntil,
  });

  const sendResult = await sendTransactionalEmail({
    to,
    subject: bodies.subject,
    html: bodies.html,
    text: bodies.text,
    from: readiness.fromConfigured ?? undefined,
    attachments: [
      {
        filename: pdf.filename,
        content: pdfBytesToBase64(pdf.bytes),
      },
    ],
  });

  // Registrar en Emails > Enviados (best-effort tras Resend OK).
  // Si el claim/finalize falla: el correo ya salió; no se reintenta Resend
  // (idempotency key evita duplicar claim; no hay segundo envío).
  if (sendResult.ok) {
    try {
      const { data: claimData } = await supabase.rpc(
        'ff_corporate_email_claim_send_v1',
        {
          p_idempotency_key: `commercial-quote:${input.quoteId}:${sha256.slice(0, 16)}`,
          p_draft_id: null,
          p_template_slug: 'custom',
          p_subject: bodies.subject,
          p_html_body: bodies.html,
          p_text_body: bodies.text,
          p_recipient_email: to,
          p_recipient_name: snapshot.contactName || null,
          p_from_address: readiness.fromConfigured,
          p_reply_to: null,
          p_purpose: 'commercial',
          p_legal_basis: 'legitimate_interest_documented',
          p_payload_hash: sha256,
          p_dry_run: false,
          p_attachment_count: 1,
          p_confirmation_ack_at: new Date().toISOString(),
          p_from_key: 'comercial',
          p_cc_emails: [],
          p_bcc_emails: [],
        }
      );
      const claim = (claimData ?? {}) as { id?: string };
      if (claim.id) {
        await supabase.rpc('ff_corporate_email_finalize_send_v1', {
          p_send_id: claim.id,
          p_status: 'sent',
          p_provider_message_id: sendResult.id ?? null,
          p_error: null,
          p_provider_status: 'accepted',
        });
      }
    } catch (err) {
      console.warn('[commercial-quotes] email_sends register', err);
    }
  }

  if (!sendResult.ok) {
    meta = appendEmailSend(meta, {
      at: new Date().toISOString(),
      to,
      status: sendResult.code === 'not_configured' ? 'not_configured' : 'failed',
      error: sendResult.error,
      by,
    });
    await supabase
      .from('commercial_quotes')
      .update({
        internal_notes: serializeQuoteInternalMeta(meta),
        updated_by: by,
      })
      .eq('id', input.quoteId);
    revalidateQuotes();
    return {
      ok: false,
      code: sendResult.code,
      error: sendResult.error,
    };
  }

  meta = appendEmailSend(meta, {
    at: new Date().toISOString(),
    to,
    status: 'sent',
    providerId: sendResult.id ?? null,
    by,
  });

  const currentStatus = row.status as CommercialQuoteStatus;
  const updates: Record<string, unknown> = {
    internal_notes: serializeQuoteInternalMeta(meta),
    updated_by: by,
  };

  if (currentStatus === 'draft') {
    meta = appendStatusHistory(meta, {
      at: new Date().toISOString(),
      from: 'draft',
      to: 'sent',
      by,
      note: `Email enviado a ${to}`,
    });
    updates.internal_notes = serializeQuoteInternalMeta(meta);
    updates.status = 'sent';
  }

  const { error: updError } = await supabase
    .from('commercial_quotes')
    .update(updates)
    .eq('id', input.quoteId);

  if (updError) {
    console.error('[commercial-quotes] after-send', updError.code, updError.message);
  }

  revalidateQuotes();
  return { ok: true, emailStatus: 'sent', to };
}
