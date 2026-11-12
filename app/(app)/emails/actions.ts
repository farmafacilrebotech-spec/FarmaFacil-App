'use server';

import { createHash, randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';

import {
  buildComposeSeed,
  isEmailTemplateSlug,
  type EmailTemplateSlug,
} from '@/lib/email/compose-catalog';
import {
  FF_EMAIL_FROM,
  FF_EMAIL_REPLY_TO,
} from '@/lib/email/corporate-templates';
import {
  assertCorporateSendPolicy,
  type EmailLegalBasis,
  type EmailPurpose,
} from '@/lib/email/corporate-send-policy';
import {
  assertCorporateSendBlocked,
  validateEmailDraftInput,
  type EmailDraftInput,
} from '@/lib/email/draft-validation';
import { requireEmailsAccess } from '@/lib/email/require-emails-access';
import { sendTransactionalEmail } from '@/lib/email/send';
import {
  corporateEmailSendReadiness,
  getCorporateEmailSendMode,
} from '@/lib/email/send-config';
import { createClient } from '@/lib/supabase/server';

export type EmailDraftRow = {
  id: string;
  templateSlug: EmailTemplateSlug;
  subject: string;
  htmlBody: string;
  textBody: string;
  recipientEmail: string;
  recipientName: string | null;
  purpose: EmailPurpose;
  legalBasis: EmailLegalBasis | null;
  commercialAuthAck: boolean;
  oppositionChecked: boolean;
  createdBy: string;
  updatedAt: string;
  createdAt: string;
};

export type EmailSendRow = {
  id: string;
  status: string;
  purpose: EmailPurpose;
  subject: string;
  recipientEmail: string;
  templateSlug: string;
  dryRun: boolean;
  error: string | null;
  providerMessageId: string | null;
  createdAt: string;
  sentAt: string | null;
};

type ActionOk<T> = { ok: true } & T;
type ActionErr = {
  ok: false;
  error: string;
  code?: 'migration_pending' | 'forbidden' | 'send_disabled' | 'blocked';
};

const DRAFT_SELECT =
  'id, template_slug, subject, html_body, text_body, recipient_email, recipient_name, purpose, legal_basis, commercial_auth_ack, opposition_checked, created_by, created_at, updated_at';

function mapDraftRow(row: Record<string, unknown>): EmailDraftRow {
  const slug = String(row.template_slug ?? 'blank');
  const purposeRaw = String(row.purpose ?? 'operational');
  const purpose: EmailPurpose =
    purposeRaw === 'commercial' ? 'commercial' : 'operational';
  const basisRaw = row.legal_basis == null ? '' : String(row.legal_basis);
  const legalBasis =
    basisRaw === 'consent' ||
    basisRaw === 'legitimate_interest_documented' ||
    basisRaw === 'contractual'
      ? (basisRaw as EmailLegalBasis)
      : null;
  return {
    id: String(row.id),
    templateSlug: isEmailTemplateSlug(slug) ? slug : 'blank',
    subject: String(row.subject ?? ''),
    htmlBody: String(row.html_body ?? ''),
    textBody: String(row.text_body ?? ''),
    recipientEmail: String(row.recipient_email ?? ''),
    recipientName:
      row.recipient_name == null || row.recipient_name === ''
        ? null
        : String(row.recipient_name),
    purpose,
    legalBasis,
    commercialAuthAck: Boolean(row.commercial_auth_ack),
    oppositionChecked: Boolean(row.opposition_checked),
    createdBy: String(row.created_by ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

function mapSendRow(row: Record<string, unknown>): EmailSendRow {
  const purposeRaw = String(row.purpose ?? 'operational');
  return {
    id: String(row.id),
    status: String(row.status ?? ''),
    purpose: purposeRaw === 'commercial' ? 'commercial' : 'operational',
    subject: String(row.subject ?? ''),
    recipientEmail: String(row.recipient_email ?? ''),
    templateSlug: String(row.template_slug ?? 'blank'),
    dryRun: Boolean(row.dry_run),
    error: row.error == null ? null : String(row.error),
    providerMessageId:
      row.provider_message_id == null
        ? null
        : String(row.provider_message_id),
    createdAt: String(row.created_at ?? ''),
    sentAt: row.sent_at == null ? null : String(row.sent_at),
  };
}

function isMissingRelation(
  error: { code?: string; message?: string } | null
): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    msg.includes('email_drafts') ||
    msg.includes('email_sends') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist')
  );
}

function migrationPendingError(): ActionErr {
  return {
    ok: false,
    code: 'migration_pending',
    error:
      'Falta migración 075/085 de emails corporativos. Puedes redactar; guardar/enviar quedará disponible tras aplicarlas.',
  };
}

function payloadHash(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  purpose: string;
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        purpose: input.purpose,
      })
    )
    .digest('hex');
}

export async function getComposeSeedAction(
  slug: string,
  previewOrigin?: string | null
): Promise<ActionOk<{ seed: ReturnType<typeof buildComposeSeed> }> | ActionErr> {
  const access = await requireEmailsAccess('read');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  if (!isEmailTemplateSlug(slug)) {
    return { ok: false, error: 'Plantilla no válida.' };
  }
  return { ok: true, seed: buildComposeSeed(slug, { previewOrigin }) };
}

export async function getCorporateEmailSendStatusAction(): Promise<
  ActionOk<{
    sendEnabled: boolean;
    dryRun: boolean;
    resendConfigured: boolean;
    fromConfigured: boolean;
    fromDomain: string | null;
    fromAddress: string;
    replyTo: string;
    missing: string[];
  }>
> {
  const access = await requireEmailsAccess('read');
  if (!access.ok) {
    return {
      ok: true,
      sendEnabled: false,
      dryRun: true,
      resendConfigured: false,
      fromConfigured: false,
      fromDomain: null,
      fromAddress: FF_EMAIL_FROM,
      replyTo: FF_EMAIL_REPLY_TO,
      missing: ['auth'],
    };
  }
  const readiness = corporateEmailSendReadiness();
  const mode = readiness.mode;
  return {
    ok: true,
    sendEnabled: mode.enabled,
    dryRun: mode.enabled ? mode.dryRun : true,
    resendConfigured: readiness.resendConfigured,
    fromConfigured: readiness.fromConfigured,
    fromDomain: readiness.fromDomain,
    fromAddress: process.env.EMAIL_FROM?.trim() || FF_EMAIL_FROM,
    replyTo: FF_EMAIL_REPLY_TO,
    missing: readiness.missing,
  };
}

export async function listEmailDraftsAction(): Promise<
  ActionOk<{ drafts: EmailDraftRow[] }> | ActionErr
> {
  const access = await requireEmailsAccess('read');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('email_drafts')
    .select(DRAFT_SELECT)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    console.error('[emails] list drafts', error.code, error.message);
    return { ok: false, error: 'No se pudieron cargar los borradores.' };
  }

  return {
    ok: true,
    drafts: (data ?? []).map((row) => mapDraftRow(row as Record<string, unknown>)),
  };
}

export async function listEmailSendsAction(): Promise<
  ActionOk<{ sends: EmailSendRow[] }> | ActionErr
> {
  const access = await requireEmailsAccess('read');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('email_sends')
    .select(
      'id, status, purpose, subject, recipient_email, template_slug, dry_run, error, provider_message_id, created_at, sent_at'
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    console.error('[emails] list sends', error.code, error.message);
    return { ok: false, error: 'No se pudo cargar el historial de envíos.' };
  }

  return {
    ok: true,
    sends: (data ?? []).map((row) => mapSendRow(row as Record<string, unknown>)),
  };
}

export async function getEmailDraftAction(
  draftId: string
): Promise<ActionOk<{ draft: EmailDraftRow }> | ActionErr> {
  const access = await requireEmailsAccess('read');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  if (!draftId) return { ok: false, error: 'Borrador no indicado.' };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('email_drafts')
    .select(DRAFT_SELECT)
    .eq('id', draftId)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    console.error('[emails] get draft', error.code, error.message);
    return { ok: false, error: 'No se pudo cargar el borrador.' };
  }
  if (!data) return { ok: false, error: 'Borrador no encontrado.' };

  return { ok: true, draft: mapDraftRow(data as Record<string, unknown>) };
}

export async function saveEmailDraftAction(
  input: EmailDraftInput
): Promise<ActionOk<{ draft: EmailDraftRow }> | ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return {
      ok: false,
      code: 'forbidden',
      error: 'No autorizado a guardar borradores.',
    };
  }

  const validated = validateEmailDraftInput(input);
  if (!validated.ok) return { ok: false, error: validated.error };

  const { draft } = validated;
  const supabase = createClient();
  const payload = {
    template_slug: draft.templateSlug,
    subject: draft.subject,
    html_body: draft.htmlBody,
    text_body: draft.textBody,
    recipient_email: draft.recipientEmail,
    recipient_name: draft.recipientName,
    purpose: draft.purpose,
    legal_basis: draft.legalBasis,
    commercial_auth_ack: draft.commercialAuthAck,
    opposition_checked: draft.oppositionChecked,
    updated_by: access.profile.id,
  };

  if (draft.id) {
    const { data, error } = await supabase
      .from('email_drafts')
      .update(payload)
      .eq('id', draft.id)
      .select(DRAFT_SELECT)
      .maybeSingle();

    if (error) {
      if (isMissingRelation(error)) return migrationPendingError();
      console.error('[emails] update draft', error.code, error.message);
      return { ok: false, error: 'No se pudo actualizar el borrador.' };
    }
    if (!data) return { ok: false, error: 'Borrador no encontrado.' };
    revalidatePath('/emails');
    revalidatePath('/emails/drafts');
    revalidatePath(`/emails/compose`);
    return { ok: true, draft: mapDraftRow(data as Record<string, unknown>) };
  }

  const { data, error } = await supabase
    .from('email_drafts')
    .insert({
      ...payload,
      created_by: access.profile.id,
    })
    .select(DRAFT_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    console.error('[emails] insert draft', error.code, error.message);
    return { ok: false, error: 'No se pudo guardar el borrador.' };
  }
  if (!data) return { ok: false, error: 'No se pudo guardar el borrador.' };

  revalidatePath('/emails');
  revalidatePath('/emails/drafts');
  return { ok: true, draft: mapDraftRow(data as Record<string, unknown>) };
}

export async function deleteEmailDraftAction(
  draftId: string
): Promise<{ ok: true } | ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  if (!draftId) return { ok: false, error: 'Borrador no indicado.' };

  const supabase = createClient();
  const { error } = await supabase.from('email_drafts').delete().eq('id', draftId);
  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    console.error('[emails] delete draft', error.code, error.message);
    return { ok: false, error: 'No se pudo eliminar el borrador.' };
  }

  revalidatePath('/emails');
  revalidatePath('/emails/drafts');
  return { ok: true };
}

/**
 * Envío corporativo 1:1 Fase B.
 * Requiere FF_CORPORATE_EMAIL_SEND_ENABLED + platform.emails.send + confirmación.
 * Dry-run por defecto (no llama a Resend).
 */
export async function sendCorporateEmailAction(input: {
  draftId?: string | null;
  idempotencyKey?: string | null;
  explicitConfirm?: boolean;
  purpose?: EmailPurpose;
  legalBasis?: EmailLegalBasis | null;
  commercialAuthAck?: boolean;
  oppositionChecked?: boolean;
  /** Campos vivos del composer si aún no se ha persistido el purpose. */
  recipientEmail?: string;
  recipientName?: string | null;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  templateSlug?: string;
}): Promise<
  | ActionOk<{
      sendId: string;
      status: string;
      dryRun: boolean;
      replay: boolean;
      providerMessageId: string | null;
    }>
  | ActionErr
> {
  const access = await requireEmailsAccess('send');
  if (!access.ok) {
    return {
      ok: false,
      code: 'forbidden',
      error: access.message || 'No autorizado a enviar (platform.emails.send).',
    };
  }

  const mode = getCorporateEmailSendMode();
  if (!mode.enabled) {
    return {
      ok: false,
      code: 'send_disabled',
      error: assertCorporateSendBlocked().error,
    };
  }

  const supabase = createClient();
  let draft: EmailDraftRow | null = null;
  if (input.draftId) {
    const loaded = await getEmailDraftAction(input.draftId);
    if (!loaded.ok) return loaded;
    draft = loaded.draft;
  }

  const templateSlug =
    input.templateSlug ||
    draft?.templateSlug ||
    'blank';
  const recipientEmail = (
    input.recipientEmail ??
    draft?.recipientEmail ??
    ''
  ).trim();
  const recipientName =
    input.recipientName !== undefined
      ? input.recipientName
      : draft?.recipientName ?? null;
  const subject = (input.subject ?? draft?.subject ?? '').trim();
  const htmlBody = input.htmlBody ?? draft?.htmlBody ?? '';
  const textBody = input.textBody ?? draft?.textBody ?? '';
  const purpose: EmailPurpose =
    input.purpose ?? draft?.purpose ?? 'operational';
  const legalBasis =
    input.legalBasis !== undefined
      ? input.legalBasis
      : draft?.legalBasis ?? null;
  const commercialAuthAck =
    input.commercialAuthAck ?? draft?.commercialAuthAck ?? false;
  const oppositionChecked =
    input.oppositionChecked ?? draft?.oppositionChecked ?? false;

  const emailNorm = recipientEmail.toLowerCase();
  const { data: suppressedRow, error: suppErr } = await supabase
    .from('email_suppression_list')
    .select('id')
    .eq('email', emailNorm)
    .maybeSingle();
  if (suppErr && !isMissingRelation(suppErr)) {
    console.error('[emails] suppression check', suppErr.message);
  }
  const recipientSuppressed = Boolean(suppressedRow?.id);

  const policy = assertCorporateSendPolicy({
    purpose,
    legalBasis,
    commercialAuthAck,
    oppositionChecked,
    recipientSuppressed,
    explicitConfirm: input.explicitConfirm === true,
    recipientEmail: emailNorm,
    subject,
    htmlBody,
    textBody,
  });
  if (!policy.ok) {
    return { ok: false, code: 'blocked', error: policy.error };
  }

  const fromAddress = process.env.EMAIL_FROM?.trim() || FF_EMAIL_FROM;
  const replyTo = FF_EMAIL_REPLY_TO;
  const idem =
    input.idempotencyKey?.trim() ||
    `ff-corp-${draft?.id || 'nodraft'}-${randomUUID()}`;
  const hash = payloadHash({
    to: emailNorm,
    subject,
    html: htmlBody,
    text: textBody,
    purpose,
  });

  const { data: claimData, error: claimErr } = await supabase.rpc(
    'ff_corporate_email_claim_send_v1',
    {
      p_idempotency_key: idem,
      p_draft_id: draft?.id ?? null,
      p_template_slug: templateSlug,
      p_subject: subject,
      p_html_body: htmlBody,
      p_text_body: textBody,
      p_recipient_email: emailNorm,
      p_recipient_name: recipientName,
      p_from_address: fromAddress,
      p_reply_to: replyTo,
      p_purpose: purpose,
      p_legal_basis: legalBasis,
      p_payload_hash: hash,
      p_dry_run: mode.dryRun,
      p_attachment_count: 0,
      p_confirmation_ack_at: new Date().toISOString(),
    }
  );

  if (claimErr) {
    if (isMissingRelation(claimErr) || /ff_corporate_email_claim/i.test(claimErr.message)) {
      return {
        ok: false,
        code: 'migration_pending',
        error:
          'Falta la migración 085 (RPC de envío). Aplícala en staging antes de probar el outbox.',
      };
    }
    console.error('[emails] claim send', claimErr.code, claimErr.message);
    const msg = claimErr.message || '';
    if (msg.includes('recipient_suppressed')) {
      return {
        ok: false,
        code: 'blocked',
        error: 'Destinatario en lista de oposición/bajas.',
      };
    }
    if (msg.includes('forbidden_emails_send')) {
      return {
        ok: false,
        code: 'forbidden',
        error: 'Falta permiso platform.emails.send.',
      };
    }
    return { ok: false, error: 'No se pudo registrar el envío en el outbox.' };
  }

  const claim = (claimData ?? {}) as Record<string, unknown>;
  const sendId = String(claim.id ?? '');
  const replay = Boolean(claim.replay);
  if (!sendId) {
    return { ok: false, error: 'Outbox no devolvió id de envío.' };
  }

  if (replay && String(claim.status) === 'sent') {
    return {
      ok: true,
      sendId,
      status: 'sent',
      dryRun: Boolean(claim.dry_run),
      replay: true,
      providerMessageId:
        claim.provider_message_id == null
          ? null
          : String(claim.provider_message_id),
    };
  }

  if (mode.dryRun) {
    const { data: fin, error: finErr } = await supabase.rpc(
      'ff_corporate_email_finalize_send_v1',
      {
        p_send_id: sendId,
        p_status: 'sent',
        p_provider_message_id: `dry-run-${sendId.slice(0, 8)}`,
        p_error: null,
      }
    );
    if (finErr) {
      console.error('[emails] finalize dry-run', finErr.message);
      return {
        ok: false,
        error: 'Outbox registrado pero no se pudo cerrar el dry-run.',
      };
    }
    const finRow = (fin ?? {}) as Record<string, unknown>;
    revalidatePath('/emails');
    revalidatePath('/emails/sends');
    return {
      ok: true,
      sendId,
      status: String(finRow.status ?? 'sent'),
      dryRun: true,
      replay,
      providerMessageId:
        finRow.provider_message_id == null
          ? null
          : String(finRow.provider_message_id),
    };
  }

  // Live Resend (solo si DRY_RUN=0 y flag ON)
  const readiness = corporateEmailSendReadiness();
  if (readiness.missing.length > 0) {
    await supabase.rpc('ff_corporate_email_finalize_send_v1', {
      p_send_id: sendId,
      p_status: 'failed',
      p_provider_message_id: null,
      p_error: `Config incompleta: ${readiness.missing.join(', ')}`,
    });
    return {
      ok: false,
      error: `Envío no configurado (${readiness.missing.join(', ')}).`,
    };
  }

  const sendResult = await sendTransactionalEmail({
    to: emailNorm,
    subject,
    html: htmlBody,
    text: textBody,
    from: fromAddress,
    replyTo,
  });

  if (!sendResult.ok) {
    await supabase.rpc('ff_corporate_email_finalize_send_v1', {
      p_send_id: sendId,
      p_status: 'failed',
      p_provider_message_id: null,
      p_error: sendResult.error,
    });
    revalidatePath('/emails/sends');
    return { ok: false, error: sendResult.error };
  }

  await supabase.rpc('ff_corporate_email_finalize_send_v1', {
    p_send_id: sendId,
    p_status: 'sent',
    p_provider_message_id: sendResult.id ?? null,
    p_error: null,
  });

  revalidatePath('/emails');
  revalidatePath('/emails/sends');
  return {
    ok: true,
    sendId,
    status: 'sent',
    dryRun: false,
    replay,
    providerMessageId: sendResult.id ?? null,
  };
}
