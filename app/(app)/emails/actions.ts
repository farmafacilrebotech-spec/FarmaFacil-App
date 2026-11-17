'use server';

import { createHash, randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';

import {
  buildComposeSeed,
  isEmailTemplateSlug,
  type EmailTemplateSlug,
} from '@/lib/email/compose-catalog';
import {
  assertCorporateSendPolicy,
  defaultPurposeForTemplate,
  emailPurposeLabel,
  isEmailPurpose,
  resolveEffectivePurpose,
  type EmailLegalBasis,
  type EmailPurpose,
} from '@/lib/email/corporate-send-policy';
import { buildProviderEmailHtml } from '@/lib/email/provider-html';
import { htmlHasEmbeddedSignature } from '@/lib/email/signature';
import {
  buildDraftAttachmentStoragePath,
  formatAttachmentBytes,
  validateAttachmentBatch,
  validateAttachmentBytes,
  EMAIL_ATTACHMENT_MAX_COUNT,
  type AttachmentSourceKind,
} from '@/lib/email/attachments';
import {
  emailHistoryLabel,
  resolveEmailHistoryKind,
  type EmailHistoryKind,
} from '@/lib/email/delivery-status';
import {
  validateEmailDraftInput,
  type EmailDraftInput,
  type EmailFromKey,
} from '@/lib/email/draft-validation';
import { requireEmailsAccess } from '@/lib/email/require-emails-access';
import { sendTransactionalEmail } from '@/lib/email/send';
import {
  corporateEmailSendReadiness,
  getCorporateEmailSendMode,
} from '@/lib/email/send-config';
import {
  assertCorporateEmailRecipientsAllowed,
  parseCorporateEmailTestRecipients,
} from '@/lib/email/send-recipient-allowlist';
import { assertEmailHasAuthoredContent } from '@/lib/email/content-validation';
import {
  assertAuthorizedSenderKey,
  defaultCorporateSenderKey,
  getCorporateSender,
  listAuthorizedSenders,
  type CorporateSender,
  type CorporateSenderKey,
} from '@/lib/email/senders';
import {
  extractComposerEditableHtml,
  htmlToPlainText,
  sanitizeEmailHtml,
} from '@/lib/email/html-sanitize';
import { normalizeRecipients } from '@/lib/email/recipients';
import { createClient } from '@/lib/supabase/server';

export type EmailTemplateRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  purpose: EmailPurpose;
  variables: unknown[];
  includeSignature: boolean;
  status: 'active' | 'archived' | 'disabled';
  systemKey: string | null;
  updatedAt: string;
};

export type EmailDraftAttachmentRow = {
  id: string;
  draftId: string;
  fileName: string;
  extension: string;
  contentType: string;
  byteSize: number;
  byteSizeLabel: string;
  storagePath: string;
  sha256: string;
  sourceKind: AttachmentSourceKind;
  createdAt: string;
};

export type EmailDraftRow = {
  id: string;
  templateSlug: EmailTemplateSlug;
  templateId: string | null;
  subject: string;
  htmlBody: string;
  textBody: string;
  recipientEmail: string;
  recipientName: string | null;
  ccEmails: string[];
  bccEmails: string[];
  purpose: EmailPurpose;
  legalBasis: EmailLegalBasis | null;
  commercialAuthAck: boolean;
  oppositionChecked: boolean;
  fromKey: EmailFromKey;
  createdBy: string;
  updatedAt: string;
  createdAt: string;
};

export type EmailSendAttachmentRow = {
  id: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  byteSizeLabel: string;
};

export type EmailSendRow = {
  id: string;
  status: string;
  purpose: EmailPurpose;
  purposeLabel: string;
  subject: string;
  recipientEmail: string;
  recipientName: string | null;
  ccEmails: string[];
  bccEmails: string[];
  fromAddress: string;
  fromKey: string;
  replyTo: string | null;
  templateSlug: string;
  dryRun: boolean;
  error: string | null;
  providerMessageId: string | null;
  providerStatus: string | null;
  providerStatusLabel: string;
  attachmentCount: number;
  createdBy: string | null;
  createdByLabel: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  bouncedAt: string | null;
  historyKind: EmailHistoryKind;
  historyLabel: string;
  trashedAt: string | null;
  /** Snapshot HTML final; null si no disponible. */
  htmlBody: string | null;
  textBody: string | null;
  finalHtmlAvailable: boolean;
  signatureIncluded: boolean;
  signatureLabel: string | null;
  attachments?: EmailSendAttachmentRow[];
};

function parsePurpose(raw: unknown): EmailPurpose {
  const v = String(raw ?? 'operational');
  return isEmailPurpose(v) ? v : 'operational';
}

function providerStatusLabelEs(status: string | null): string {
  if (!status) return '—';
  const s = status.toLowerCase();
  // Código técnico del proveedor (no duplicar el estado de historial)
  if (s === 'simulated') return 'simulated (sin Resend)';
  if (s === 'accepted') return 'accepted (Resend)';
  if (s === 'delivered') return 'delivered';
  if (s === 'bounced') return 'bounced';
  if (s === 'complained') return 'complained';
  return status;
}

type ActionOk<T> = { ok: true } & T;
type ActionErr = {
  ok: false;
  error: string;
  code?: 'migration_pending' | 'forbidden' | 'send_disabled' | 'blocked';
};

const DRAFT_SELECT =
  'id, template_slug, template_id, subject, html_body, text_body, recipient_email, recipient_name, cc_emails, bcc_emails, purpose, legal_basis, commercial_auth_ack, opposition_checked, from_key, created_by, created_at, updated_at';

const ATTACH_SELECT =
  'id, draft_id, file_name, content_type, byte_size, storage_path, sha256, source_kind, created_at';

function mapDraftRow(row: Record<string, unknown>): EmailDraftRow {
  const slug = String(row.template_slug ?? 'blank');
  const purpose = parsePurpose(row.purpose);
  const basisRaw = row.legal_basis == null ? '' : String(row.legal_basis);
  const legalBasis =
    basisRaw === 'consent' ||
    basisRaw === 'legitimate_interest_documented' ||
    basisRaw === 'contractual'
      ? (basisRaw as EmailLegalBasis)
      : null;
  const fromRaw = String(row.from_key ?? 'pilar');
  const fromKey = (
    [
      'pilar',
      'contacto',
      'info',
      'soporte',
      'pruebas',
      'ventas',
      'admin',
      'privacidad',
      'demo',
      'comercial',
      'facturacion',
    ] as const
  ).includes(fromRaw as EmailFromKey)
    ? (fromRaw as EmailFromKey)
    : 'pilar';
  const ccEmails = Array.isArray(row.cc_emails)
    ? (row.cc_emails as string[]).map((e) => String(e).toLowerCase())
    : [];
  const bccEmails = Array.isArray(row.bcc_emails)
    ? (row.bcc_emails as string[]).map((e) => String(e).toLowerCase())
    : [];
  return {
    id: String(row.id),
    templateSlug: isEmailTemplateSlug(slug) ? slug : 'blank',
    templateId:
      row.template_id == null || row.template_id === ''
        ? null
        : String(row.template_id),
    subject: String(row.subject ?? ''),
    htmlBody: String(row.html_body ?? ''),
    textBody: String(row.text_body ?? ''),
    recipientEmail: String(row.recipient_email ?? ''),
    recipientName:
      row.recipient_name == null || row.recipient_name === ''
        ? null
        : String(row.recipient_name),
    ccEmails,
    bccEmails,
    purpose,
    legalBasis,
    commercialAuthAck: Boolean(row.commercial_auth_ack),
    oppositionChecked: Boolean(row.opposition_checked),
    fromKey,
    createdBy: String(row.created_by ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

function mapAttachmentRow(row: Record<string, unknown>): EmailDraftAttachmentRow {
  const fileName = String(row.file_name ?? 'adjunto');
  const ext = fileName.includes('.')
    ? fileName.split('.').pop()!.toLowerCase()
    : '';
  const sourceRaw = String(row.source_kind ?? 'upload');
  const sourceKind = (
    [
      'upload',
      'generated_quote',
      'generated_contract',
      'generated_invoice',
      'generated_other',
    ] as const
  ).includes(sourceRaw as AttachmentSourceKind)
    ? (sourceRaw as AttachmentSourceKind)
    : 'upload';
  const byteSize = Number(row.byte_size ?? 0);
  return {
    id: String(row.id),
    draftId: String(row.draft_id),
    fileName,
    extension: ext,
    contentType: String(row.content_type ?? ''),
    byteSize,
    byteSizeLabel: formatAttachmentBytes(byteSize),
    storagePath: String(row.storage_path ?? ''),
    sha256: String(row.sha256 ?? ''),
    sourceKind,
    createdAt: String(row.created_at ?? ''),
  };
}

function mapSendRow(
  row: Record<string, unknown>,
  profileLabel?: string | null,
  opts?: { includeBody?: boolean; attachments?: EmailSendAttachmentRow[] }
): EmailSendRow {
  const purpose = parsePurpose(row.purpose);
  const providerStatus =
    row.provider_status == null ? null : String(row.provider_status);
  const historyKind = resolveEmailHistoryKind({
    status: String(row.status ?? ''),
    providerStatus,
    dryRun: Boolean(row.dry_run),
    providerMessageId:
      row.provider_message_id == null
        ? null
        : String(row.provider_message_id),
    bouncedAt: row.bounced_at == null ? null : String(row.bounced_at),
    deliveredAt: row.delivered_at == null ? null : String(row.delivered_at),
  });
  const hasHtmlColumn = Object.prototype.hasOwnProperty.call(row, 'html_body');
  const rawHtml = hasHtmlColumn ? String(row.html_body ?? '') : '';
  const finalHtmlAvailable =
    row.final_html_available != null
      ? Boolean(row.final_html_available) &&
        (!hasHtmlColumn || rawHtml.trim().length > 0)
      : hasHtmlColumn
        ? rawHtml.trim().length > 0
        : true;
  const ccEmails = Array.isArray(row.cc_emails)
    ? (row.cc_emails as string[]).map((e) => String(e).toLowerCase())
    : [];
  const bccEmails = Array.isArray(row.bcc_emails)
    ? (row.bcc_emails as string[]).map((e) => String(e).toLowerCase())
    : [];
  const includeBody = opts?.includeBody === true;
  return {
    id: String(row.id),
    status: String(row.status ?? ''),
    purpose,
    purposeLabel: emailPurposeLabel(purpose),
    subject: String(row.subject ?? ''),
    recipientEmail: String(row.recipient_email ?? ''),
    recipientName:
      row.recipient_name == null || row.recipient_name === ''
        ? null
        : String(row.recipient_name),
    ccEmails,
    bccEmails,
    fromAddress: String(row.from_address ?? ''),
    fromKey: String(row.from_key ?? 'pilar'),
    replyTo:
      row.reply_to == null || row.reply_to === ''
        ? null
        : String(row.reply_to),
    templateSlug: String(row.template_slug ?? 'blank'),
    dryRun: Boolean(row.dry_run),
    error: row.error == null ? null : String(row.error),
    providerMessageId:
      row.provider_message_id == null
        ? null
        : String(row.provider_message_id),
    providerStatus,
    providerStatusLabel: Boolean(row.dry_run)
      ? 'simulated (sin Resend)'
      : providerStatusLabelEs(providerStatus),
    attachmentCount: Number(row.attachment_count ?? 0),
    createdBy: row.created_by == null ? null : String(row.created_by),
    createdByLabel: profileLabel ?? null,
    createdAt: String(row.created_at ?? ''),
    sentAt: row.sent_at == null ? null : String(row.sent_at),
    deliveredAt: row.delivered_at == null ? null : String(row.delivered_at),
    bouncedAt: row.bounced_at == null ? null : String(row.bounced_at),
    historyKind,
    historyLabel: emailHistoryLabel(historyKind, {
      dryRun: Boolean(row.dry_run),
    }),
    trashedAt: row.trashed_at == null ? null : String(row.trashed_at),
    htmlBody: includeBody && finalHtmlAvailable ? rawHtml : null,
    textBody:
      includeBody && finalHtmlAvailable
        ? String(row.text_body ?? '')
        : null,
    finalHtmlAvailable,
    signatureIncluded: (() => {
      if (Boolean(row.signature_included)) return true;
      // Legacy / metadato ausente: detectar en snapshot HTML si está disponible
      if (includeBody && finalHtmlAvailable && rawHtml) {
        return htmlHasEmbeddedSignature(rawHtml);
      }
      return false;
    })(),
    signatureLabel: (() => {
      const labeled =
        row.signature_label == null || row.signature_label === ''
          ? null
          : String(row.signature_label);
      if (labeled) return labeled;
      if (
        includeBody &&
        finalHtmlAvailable &&
        rawHtml &&
        htmlHasEmbeddedSignature(rawHtml)
      ) {
        return 'Detectada en el HTML enviado';
      }
      return null;
    })(),
    attachments: opts?.attachments,
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
    msg.includes('email_draft_attachments') ||
    msg.includes('email_templates') ||
    msg.includes('cc_emails') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist')
  );
}

function migrationPendingError(): ActionErr {
  return {
    ok: false,
    code: 'migration_pending',
    error:
      'Falta migración de emails corporativos (075/085/086). Puedes redactar; guardar/enviar quedará disponible tras aplicarlas.',
  };
}

function payloadHash(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  purpose: string;
  fromKey: string;
  attachmentIds: string[];
}): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        purpose: input.purpose,
        fromKey: input.fromKey,
        attachments: input.attachmentIds,
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

export async function listCorporateSendersAction(): Promise<
  ActionOk<{
    senders: CorporateSender[];
    defaultKey: CorporateSenderKey;
    domain: string | null;
  }>
> {
  const access = await requireEmailsAccess('read');
  if (!access.ok) {
    return {
      ok: true,
      senders: [],
      defaultKey: defaultCorporateSenderKey(),
      domain: null,
    };
  }
  const senders = listAuthorizedSenders();
  const readiness = corporateEmailSendReadiness();
  return {
    ok: true,
    senders,
    defaultKey: defaultCorporateSenderKey(),
    domain: readiness.fromDomain,
  };
}

export type PharmacyPortfolioRecipientRow = {
  pharmacyId: string;
  pharmacyName: string;
  contactName: string | null;
  email: string;
  city: string | null;
  province: string | null;
  authorizedAt: string;
};

export async function listPharmacyPortfolioRecipientsAction(input?: {
  query?: string;
}): Promise<
  | ActionOk<{
      available: boolean;
      recipients: PharmacyPortfolioRecipientRow[];
      notice: string | null;
    }>
  | ActionErr
> {
  const access = await requireEmailsAccess('read');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  const { listPharmacyPortfolioCommercialRecipients } = await import(
    '@/lib/email/pharmacy-portfolio-recipients'
  );
  const result = await listPharmacyPortfolioCommercialRecipients({
    query: input?.query,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    available: result.available,
    recipients: result.recipients,
    notice: result.notice,
  };
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
    /** Motivo legible si Enviar está deshabilitado o restringido. */
    disabledReason: string | null;
    /** Allowlist de prueba configurada (sin listar emails en UI pública). */
    testAllowlistConfigured: boolean;
    testAllowlistCount: number;
  }>
> {
  const access = await requireEmailsAccess('read');
  const defaultSender = getCorporateSender('pilar');
  const { parseCorporateEmailTestRecipients } = await import(
    '@/lib/email/send-recipient-allowlist'
  );
  const allow = parseCorporateEmailTestRecipients();
  if (!access.ok) {
    return {
      ok: true,
      sendEnabled: false,
      dryRun: true,
      resendConfigured: false,
      fromConfigured: false,
      fromDomain: null,
      fromAddress: defaultSender.fromHeader,
      replyTo: defaultSender.replyTo,
      missing: ['auth'],
      disabledReason: 'Sesión no autorizada para el módulo Emails.',
      testAllowlistConfigured: Boolean(allow?.length),
      testAllowlistCount: allow?.length ?? 0,
    };
  }
  const readiness = corporateEmailSendReadiness();
  const mode = readiness.mode;
  let disabledReason: string | null = null;
  if (!mode.enabled) {
    disabledReason =
      'Envío desactivado: falta FF_CORPORATE_EMAIL_SEND_ENABLED=1 en el entorno del servidor.';
  } else if (readiness.missing.length > 0) {
    disabledReason = `Configuración incompleta: ${readiness.missing.join(', ')}.`;
  } else if (!mode.dryRun && !allow?.length) {
    disabledReason =
      'Envío real bloqueado: define FF_CORPORATE_EMAIL_TEST_RECIPIENTS (allowlist).';
  }
  // El botón se habilita si el flag está ON; la allowlist se exige al confirmar live.
  const sendEnabled = mode.enabled && readiness.missing.length === 0;
  return {
    ok: true,
    sendEnabled,
    dryRun: mode.enabled ? mode.dryRun : true,
    resendConfigured: readiness.resendConfigured,
    fromConfigured: readiness.fromConfigured,
    fromDomain: readiness.fromDomain,
    fromAddress: process.env.EMAIL_FROM?.trim() || defaultSender.fromHeader,
    replyTo: defaultSender.replyTo,
    missing: readiness.missing,
    disabledReason: sendEnabled ? null : disabledReason,
    testAllowlistConfigured: Boolean(allow?.length),
    testAllowlistCount: allow?.length ?? 0,
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
  let query = supabase
    .from('email_drafts')
    .select(DRAFT_SELECT)
    .is('trashed_at', null)
    .order('updated_at', { ascending: false })
    .limit(100);
  // 090: excluir borradores consumidos tras envío (si la columna existe)
  query = query.is('consumed_at', null);
  const { data, error } = await query;

  if (error) {
    if (/consumed_at/i.test(error.message || '')) {
      const fallback = await supabase
        .from('email_drafts')
        .select(DRAFT_SELECT)
        .is('trashed_at', null)
        .order('updated_at', { ascending: false })
        .limit(100);
      if (fallback.error) {
        if (isMissingRelation(fallback.error)) return migrationPendingError();
        return { ok: false, error: 'No se pudieron cargar los borradores.' };
      }
      return {
        ok: true,
        drafts: (fallback.data ?? []).map((row) =>
          mapDraftRow(row as Record<string, unknown>)
        ),
      };
    }
    if (isMissingRelation(error)) return migrationPendingError();
    console.error('[emails] list drafts', error.code, error.message);
    return { ok: false, error: 'No se pudieron cargar los borradores.' };
  }

  return {
    ok: true,
    drafts: (data ?? []).map((row) => mapDraftRow(row as Record<string, unknown>)),
  };
}

export async function listTrashedEmailDraftsAction(): Promise<
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
    .not('trashed_at', 'is', null)
    .is('consumed_at', null)
    .order('trashed_at', { ascending: false })
    .limit(100);
  if (error) {
    if (/consumed_at/i.test(error.message || '')) {
      const fallback = await supabase
        .from('email_drafts')
        .select(DRAFT_SELECT)
        .not('trashed_at', 'is', null)
        .order('trashed_at', { ascending: false })
        .limit(100);
      if (fallback.error) {
        if (isMissingRelation(fallback.error)) return migrationPendingError();
        return { ok: false, error: 'No se pudo cargar la papelera.' };
      }
      return {
        ok: true,
        drafts: (fallback.data ?? []).map((row) =>
          mapDraftRow(row as Record<string, unknown>)
        ),
      };
    }
    if (isMissingRelation(error)) return migrationPendingError();
    return { ok: false, error: 'No se pudo cargar la papelera.' };
  }
  return {
    ok: true,
    drafts: (data ?? []).map((row) => mapDraftRow(row as Record<string, unknown>)),
  };
}

export async function trashEmailDraftAction(
  draftId: string
): Promise<{ ok: true } | ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  if (!draftId) return { ok: false, error: 'Borrador no indicado.' };
  const supabase = createClient();
  const { error } = await supabase
    .from('email_drafts')
    .update({ trashed_at: new Date().toISOString(), updated_by: access.profile.id })
    .eq('id', draftId);
  if (error) {
    if (isMissingRelation(error) || /trashed_at/i.test(error.message || '')) {
      // Fallback: eliminar si aún no hay columna
      return deleteEmailDraftAction(draftId);
    }
    return { ok: false, error: 'No se pudo mover a la papelera.' };
  }
  revalidatePath('/emails/drafts');
  revalidatePath('/emails/trash');
  return { ok: true };
}

export async function restoreEmailDraftAction(
  draftId: string
): Promise<{ ok: true } | ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from('email_drafts')
    .update({ trashed_at: null, updated_by: access.profile.id })
    .eq('id', draftId);
  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    return { ok: false, error: 'No se pudo restaurar el borrador.' };
  }
  revalidatePath('/emails/drafts');
  revalidatePath('/emails/trash');
  return { ok: true };
}

const SEND_LIST_SELECT =
  'id, status, purpose, subject, recipient_email, recipient_name, cc_emails, bcc_emails, from_address, reply_to, from_key, template_slug, dry_run, error, provider_message_id, provider_status, attachment_count, created_by, created_at, sent_at, delivered_at, bounced_at, trashed_at, signature_included, signature_label, final_html_available';

const SEND_DETAIL_SELECT = `${SEND_LIST_SELECT}, html_body, text_body`;

async function loadProfileLabels(
  supabase: ReturnType<typeof createClient>,
  userIds: string[]
): Promise<Map<string, string>> {
  const labelById = new Map<string, string>();
  if (userIds.length === 0) return labelById;
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);
  for (const p of profiles ?? []) {
    const row = p as {
      id: string;
      full_name?: string | null;
      email?: string | null;
    };
    labelById.set(
      row.id,
      (row.full_name || row.email || row.id.slice(0, 8)).trim()
    );
  }
  return labelById;
}

export async function listEmailSendsAction(): Promise<
  ActionOk<{ sends: EmailSendRow[] }> | ActionErr
> {
  const access = await requireEmailsAccess('read');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }

  const supabase = createClient();
  const primary = await supabase
    .from('email_sends')
    .select(SEND_LIST_SELECT)
    .is('trashed_at', null)
    .is('user_hidden_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  let rowsRaw: unknown[] | null = primary.data;
  let error = primary.error;

  if (error && /trashed_at|user_hidden_at|signature_|final_html/i.test(error.message || '')) {
    const fallback = await supabase
      .from('email_sends')
      .select(
        'id, status, purpose, subject, recipient_email, recipient_name, cc_emails, bcc_emails, from_address, reply_to, from_key, template_slug, dry_run, error, provider_message_id, provider_status, attachment_count, created_by, created_at, sent_at, delivered_at, bounced_at, html_body'
      )
      .order('created_at', { ascending: false })
      .limit(100);
    rowsRaw = fallback.data;
    error = fallback.error;
  }

  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    console.error('[emails] list sends', error.code, error.message);
    return { ok: false, error: 'No se pudo cargar el historial de envíos.' };
  }

  const rows = (rowsRaw ?? []) as Record<string, unknown>[];
  const userIds = Array.from(
    new Set(
      rows
        .map((r) => (r.created_by == null ? null : String(r.created_by)))
        .filter((v): v is string => Boolean(v))
    )
  );
  const labelById = await loadProfileLabels(supabase, userIds);

  return {
    ok: true,
    sends: rows.map((row) =>
      mapSendRow(
        row,
        row.created_by ? labelById.get(String(row.created_by)) ?? null : null,
        { includeBody: false }
      )
    ),
  };
}

export async function listTrashedEmailSendsAction(): Promise<
  ActionOk<{ sends: EmailSendRow[] }> | ActionErr
> {
  const access = await requireEmailsAccess('read');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from('email_sends')
    .select(SEND_LIST_SELECT)
    .not('trashed_at', 'is', null)
    .is('user_hidden_at', null)
    .order('trashed_at', { ascending: false })
    .limit(100);
  if (error) {
    if (/trashed_at|user_hidden/i.test(error.message || '')) {
      return { ok: true, sends: [] };
    }
    if (isMissingRelation(error)) return migrationPendingError();
    return { ok: false, error: 'No se pudo cargar la papelera de enviados.' };
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  const userIds = Array.from(
    new Set(
      rows
        .map((r) => (r.created_by == null ? null : String(r.created_by)))
        .filter((v): v is string => Boolean(v))
    )
  );
  const labelById = await loadProfileLabels(supabase, userIds);
  return {
    ok: true,
    sends: rows.map((row) =>
      mapSendRow(
        row,
        row.created_by ? labelById.get(String(row.created_by)) ?? null : null
      )
    ),
  };
}

export async function getEmailSendDetailAction(
  sendId: string
): Promise<ActionOk<{ send: EmailSendRow }> | ActionErr> {
  const access = await requireEmailsAccess('read');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  if (!sendId) return { ok: false, error: 'Envío no indicado.' };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('email_sends')
    .select(SEND_DETAIL_SELECT)
    .eq('id', sendId)
    .maybeSingle();

  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    return { ok: false, error: 'No se pudo cargar el correo enviado.' };
  }
  if (!data) return { ok: false, error: 'Correo enviado no encontrado.' };

  const row = data as Record<string, unknown>;
  let label: string | null = null;
  if (row.created_by) {
    const labels = await loadProfileLabels(supabase, [String(row.created_by)]);
    label = labels.get(String(row.created_by)) ?? null;
  }

  const { data: attRows } = await supabase
    .from('email_send_attachments')
    .select('id, file_name, content_type, byte_size')
    .eq('send_id', sendId)
    .order('created_at', { ascending: true });

  const attachments: EmailSendAttachmentRow[] = (attRows ?? []).map((a) => {
    const r = a as Record<string, unknown>;
    const byteSize = Number(r.byte_size ?? 0);
    return {
      id: String(r.id),
      fileName: String(r.file_name ?? 'adjunto'),
      contentType: String(r.content_type ?? ''),
      byteSize,
      byteSizeLabel: formatAttachmentBytes(byteSize),
    };
  });

  return {
    ok: true,
    send: mapSendRow(row, label, { includeBody: true, attachments }),
  };
}

export async function trashEmailSendAction(
  sendId: string
): Promise<{ ok: true } | ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  if (!sendId) return { ok: false, error: 'Envío no indicado.' };
  const supabase = createClient();
  const { error } = await supabase
    .from('email_sends')
    .update({ trashed_at: new Date().toISOString() })
    .eq('id', sendId)
    .is('user_hidden_at', null);
  if (error) {
    if (/trashed_at/i.test(error.message || '')) {
      return migrationPendingError();
    }
    return { ok: false, error: 'No se pudo mover el envío a la papelera.' };
  }
  revalidatePath('/emails/sends');
  revalidatePath('/emails/trash');
  return { ok: true };
}

export async function restoreEmailSendAction(
  sendId: string
): Promise<{ ok: true } | ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  if (!sendId) return { ok: false, error: 'Envío no indicado.' };
  const supabase = createClient();
  const { error } = await supabase
    .from('email_sends')
    .update({ trashed_at: null })
    .eq('id', sendId)
    .is('user_hidden_at', null);
  if (error) {
    if (/trashed_at/i.test(error.message || '')) {
      return migrationPendingError();
    }
    return { ok: false, error: 'No se pudo restaurar el envío.' };
  }
  revalidatePath('/emails/sends');
  revalidatePath('/emails/trash');
  return { ok: true };
}

/** Oculta de la UI del usuario; conserva auditoría y evidencias. */
export async function hideEmailSendFromUserViewAction(
  sendId: string
): Promise<{ ok: true } | ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  if (!sendId) return { ok: false, error: 'Envío no indicado.' };
  const supabase = createClient();
  const { error } = await supabase
    .from('email_sends')
    .update({
      user_hidden_at: new Date().toISOString(),
      trashed_at: new Date().toISOString(),
    })
    .eq('id', sendId);
  if (error) {
    if (/user_hidden_at|trashed_at/i.test(error.message || '')) {
      return migrationPendingError();
    }
    return {
      ok: false,
      error: 'No se pudo ocultar el envío de la vista.',
    };
  }
  revalidatePath('/emails/sends');
  revalidatePath('/emails/trash');
  return { ok: true };
}

export async function getSendAttachmentDownloadUrlAction(
  sendId: string,
  attachmentId: string
): Promise<ActionOk<{ url: string; fileName: string }> | ActionErr> {
  const access = await requireEmailsAccess('read');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  if (!sendId || !attachmentId) {
    return { ok: false, error: 'Adjunto no indicado.' };
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from('email_send_attachments')
    .select('id, file_name, storage_path, send_id')
    .eq('id', attachmentId)
    .eq('send_id', sendId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: 'Adjunto no encontrado.' };
  }
  const path = String((data as { storage_path?: string }).storage_path || '');
  const fileName = String(
    (data as { file_name?: string }).file_name || 'adjunto'
  );
  if (!path) return { ok: false, error: 'Ruta de adjunto no disponible.' };

  const { data: signed, error: signErr } = await supabase.storage
    .from('email-attachments')
    .createSignedUrl(path, 120);
  if (signErr || !signed?.signedUrl) {
    return { ok: false, error: 'No se pudo generar el enlace de descarga.' };
  }
  return { ok: true, url: signed.signedUrl, fileName };
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

export async function listDraftAttachmentsAction(
  draftId: string
): Promise<ActionOk<{ attachments: EmailDraftAttachmentRow[] }> | ActionErr> {
  const access = await requireEmailsAccess('read');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  if (!draftId) return { ok: true, attachments: [] };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('email_draft_attachments')
    .select(ATTACH_SELECT)
    .eq('draft_id', draftId)
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    console.error('[emails] list attachments', error.code, error.message);
    return { ok: false, error: 'No se pudieron cargar los adjuntos.' };
  }

  return {
    ok: true,
    attachments: (data ?? []).map((row) =>
      mapAttachmentRow(row as Record<string, unknown>)
    ),
  };
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

  const senderCheck = assertAuthorizedSenderKey(validated.draft.fromKey);
  if (!senderCheck.ok) return { ok: false, error: senderCheck.error };

  const { draft } = validated;
  const purpose = resolveEffectivePurpose(
    draft.templateSlug === 'custom' ? 'blank' : draft.templateSlug,
    draft.purpose
  );
  const supabase = createClient();
  const payload = {
    template_slug: draft.templateSlug,
    template_id: draft.templateId,
    subject: draft.subject,
    html_body: sanitizeEmailHtml(draft.htmlBody),
    text_body: draft.textBody || htmlToPlainText(draft.htmlBody),
    recipient_email: draft.recipientEmail,
    recipient_name: draft.recipientName,
    cc_emails: draft.ccEmails,
    bcc_emails: draft.bccEmails,
    purpose,
    legal_basis: draft.legalBasis,
    commercial_auth_ack: draft.commercialAuthAck,
    opposition_checked: draft.oppositionChecked,
    from_key: draft.fromKey,
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
      // from_key puede faltar si 086 no aplicada
      if (/from_key/i.test(error.message || '')) {
        return migrationPendingError();
      }
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
    if (/from_key/i.test(error.message || '')) {
      return migrationPendingError();
    }
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
  const { data: atts } = await supabase
    .from('email_draft_attachments')
    .select('storage_path')
    .eq('draft_id', draftId);
  const paths = (atts ?? [])
    .map((a) => String((a as { storage_path?: string }).storage_path || ''))
    .filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from('email-attachments').remove(paths);
  }

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

export async function uploadDraftAttachmentAction(formData: FormData): Promise<
  ActionOk<{ attachment: EmailDraftAttachmentRow; draftId: string }> | ActionErr
> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }

  let draftId = String(formData.get('draftId') || '').trim();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { ok: false, error: 'No se recibió ningún archivo.' };
  }

  const supabase = createClient();

  // Guardar borrador mínimo si aún no existe
  if (!draftId) {
    const seedInput: EmailDraftInput = {
      templateSlug: String(formData.get('templateSlug') || 'blank'),
      subject: String(formData.get('subject') || ''),
      htmlBody: String(formData.get('htmlBody') || ''),
      textBody: String(formData.get('textBody') || ''),
      recipientEmail: String(formData.get('recipientEmail') || ''),
      recipientName: String(formData.get('recipientName') || '') || null,
      ccEmails: String(formData.get('ccEmails') || ''),
      bccEmails: String(formData.get('bccEmails') || ''),
      purpose: String(formData.get('purpose') || 'operational'),
      legalBasis: String(formData.get('legalBasis') || '') || null,
      commercialAuthAck: formData.get('commercialAuthAck') === '1',
      oppositionChecked: formData.get('oppositionChecked') === '1',
      fromKey: String(formData.get('fromKey') || 'pilar'),
    };
    const saved = await saveEmailDraftAction(seedInput);
    if (!saved.ok) return saved;
    draftId = saved.draft.id;
  }

  const { data: existing, error: listErr } = await supabase
    .from('email_draft_attachments')
    .select('id, byte_size, file_name, content_type')
    .eq('draft_id', draftId);
  if (listErr) {
    if (isMissingRelation(listErr)) return migrationPendingError();
    return { ok: false, error: 'No se pudieron comprobar los adjuntos.' };
  }
  const current = (existing ?? []) as Array<{
    id: string;
    byte_size: number;
    file_name: string;
    content_type: string;
  }>;
  if (current.length >= EMAIL_ATTACHMENT_MAX_COUNT) {
    return {
      ok: false,
      error: `Máximo ${EMAIL_ATTACHMENT_MAX_COUNT} adjuntos por borrador.`,
    };
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  const validated = validateAttachmentBytes({
    fileName: file.name,
    contentType: file.type || '',
    bytes: buf,
  });
  if (!validated.ok) return { ok: false, error: validated.error };

  const batch = validateAttachmentBatch([
    ...current.map((c) => ({
      fileName: c.file_name,
      contentType: c.content_type,
      byteSize: c.byte_size,
    })),
    {
      fileName: validated.fileName,
      contentType: validated.contentType,
      byteSize: validated.byteSize,
    },
  ]);
  if (!batch.ok) return { ok: false, error: batch.error };

  const attachmentId = randomUUID();
  const storagePath = buildDraftAttachmentStoragePath({
    draftId,
    attachmentId,
    fileName: validated.fileName,
  });
  const sha256 = createHash('sha256').update(buf).digest('hex');

  const { error: upErr } = await supabase.storage
    .from('email-attachments')
    .upload(storagePath, buf, {
      contentType: validated.contentType,
      upsert: false,
    });
  if (upErr) {
    console.error('[emails] storage upload', upErr.message);
    return {
      ok: false,
      error:
        'No se pudo subir el adjunto al almacenamiento privado. Comprueba permisos/bucket.',
    };
  }

  const { data: row, error: insErr } = await supabase
    .from('email_draft_attachments')
    .insert({
      id: attachmentId,
      draft_id: draftId,
      file_name: validated.fileName,
      content_type: validated.contentType,
      byte_size: validated.byteSize,
      storage_path: storagePath,
      sha256,
      source_kind: 'upload',
      source_ref: {},
      created_by: access.profile.id,
    })
    .select(ATTACH_SELECT)
    .maybeSingle();

  if (insErr || !row) {
    await supabase.storage.from('email-attachments').remove([storagePath]);
    if (insErr && isMissingRelation(insErr)) return migrationPendingError();
    console.error('[emails] insert attachment', insErr?.message);
    return { ok: false, error: 'No se pudo registrar el adjunto.' };
  }

  revalidatePath('/emails/compose');
  return {
    ok: true,
    draftId,
    attachment: mapAttachmentRow(row as Record<string, unknown>),
  };
}

export async function deleteDraftAttachmentAction(
  attachmentId: string
): Promise<{ ok: true } | ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  if (!attachmentId) return { ok: false, error: 'Adjunto no indicado.' };

  const supabase = createClient();
  const { data, error } = await supabase
    .from('email_draft_attachments')
    .select('id, storage_path')
    .eq('id', attachmentId)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    return { ok: false, error: 'No se pudo eliminar el adjunto.' };
  }
  if (!data) return { ok: false, error: 'Adjunto no encontrado.' };

  const path = String((data as { storage_path: string }).storage_path || '');
  if (path) {
    await supabase.storage.from('email-attachments').remove([path]);
  }
  const { error: delErr } = await supabase
    .from('email_draft_attachments')
    .delete()
    .eq('id', attachmentId);
  if (delErr) {
    return { ok: false, error: 'No se pudo eliminar el adjunto.' };
  }
  revalidatePath('/emails/compose');
  return { ok: true };
}

/**
 * Envío corporativo 1:1 Fase B.
 * Requiere FF_CORPORATE_EMAIL_SEND_ENABLED + platform.emails.send + confirmación.
 * Dry-run por defecto (no llama a Resend).
 */
export async function listEmailTemplatesAction(opts?: {
  /** Por defecto solo activas (desplegable compositor). */
  includeArchived?: boolean;
}): Promise<ActionOk<{ templates: EmailTemplateRow[] }> | ActionErr> {
  const access = await requireEmailsAccess('read');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  const supabase = createClient();
  let q = supabase
    .from('email_templates')
    .select(
      'id, slug, name, category, subject, html_body, text_body, purpose, variables, include_signature, status, system_key, updated_at'
    )
    .order('name', { ascending: true })
    .limit(200);
  if (!opts?.includeArchived) {
    q = q.eq('status', 'active');
  }
  const { data, error } = await q;
  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    console.error('[emails] list templates', error.message);
    return { ok: false, error: 'No se pudieron cargar las plantillas.' };
  }
  const templates = (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const statusRaw = String(r.status ?? 'active');
    const status =
      statusRaw === 'archived' || statusRaw === 'disabled'
        ? statusRaw
        : 'active';
    return {
      id: String(r.id),
      slug: String(r.slug ?? ''),
      name: String(r.name ?? ''),
      category: String(r.category ?? 'general'),
      subject: String(r.subject ?? ''),
      htmlBody: String(r.html_body ?? ''),
      textBody: String(r.text_body ?? ''),
      purpose: parsePurpose(r.purpose),
      variables: Array.isArray(r.variables) ? (r.variables as unknown[]) : [],
      includeSignature: Boolean(r.include_signature ?? true),
      status: status as EmailTemplateRow['status'],
      systemKey: r.system_key == null ? null : String(r.system_key),
      updatedAt: String(r.updated_at ?? ''),
    };
  });
  return { ok: true, templates };
}

/**
 * Siembra inicial ÚNICA de plantillas corporativas.
 * No sobrescribe ni regenera si ya existe cualquier fila con ese system_key
 * (activa o archivada). Conserva ediciones del usuario.
 */
export async function ensureSystemEmailTemplatesAction(previewOrigin?: string | null): Promise<
  ActionOk<{ seeded: number }> | ActionErr
> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  const { htmlHasEmbeddedSignature } = await import('@/lib/email/signature');
  const supabase = createClient();
  const systemSlugs = ['lanzadera', 'imprentas', 'demo', 'piloto'] as const;
  let seeded = 0;
  for (const slug of systemSlugs) {
    const { data: existing } = await supabase
      .from('email_templates')
      .select('id')
      .eq('system_key', slug)
      .limit(1)
      .maybeSingle();
    if (existing?.id) continue;
    // También evitar regenerar si ya hay una plantilla con el mismo nombre activo
    const seed = buildComposeSeed(slug, { previewOrigin });
    const { data: byName } = await supabase
      .from('email_templates')
      .select('id')
      .ilike('name', seed.title)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (byName?.id) {
      // Vincular system_key a la existente sin tocar contenido
      await supabase
        .from('email_templates')
        .update({ system_key: slug, updated_by: access.profile.id })
        .eq('id', byName.id)
        .is('system_key', null);
      continue;
    }
    const editable = extractComposerEditableHtml(seed.htmlBody);
    const hasSig = htmlHasEmbeddedSignature(editable);
    const { error } = await supabase.from('email_templates').insert({
      slug: `system-${slug}`,
      name: seed.title,
      category: 'corporativa',
      subject: seed.subject,
      html_body: editable,
      text_body: seed.textBody,
      purpose: defaultPurposeForTemplate(slug),
      variables: [],
      include_signature: !hasSig,
      status: 'active',
      system_key: slug,
      created_by: access.profile.id,
      updated_by: access.profile.id,
    });
    if (error) {
      if (isMissingRelation(error)) return migrationPendingError();
      if (!/duplicate|unique/i.test(error.message || '')) {
        console.error('[emails] seed template', slug, error.message);
      }
      continue;
    }
    seeded += 1;
  }
  if (seeded > 0) revalidatePath('/emails/templates');
  return { ok: true, seeded };
}

export async function updateEmailTemplateAction(input: {
  templateId: string;
  name?: string;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  includeSignature?: boolean;
  purpose?: EmailPurpose;
}): Promise<ActionOk<{ template: EmailTemplateRow }> | ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  const patch: Record<string, unknown> = {
    updated_by: access.profile.id,
  };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name || name.length > 200) {
      return { ok: false, error: 'Nombre no válido.' };
    }
    patch.name = name;
  }
  if (input.subject !== undefined) {
    patch.subject = input.subject.trim().slice(0, 500);
  }
  if (input.htmlBody !== undefined) {
    patch.html_body = sanitizeEmailHtml(input.htmlBody);
    patch.text_body =
      input.textBody || htmlToPlainText(String(patch.html_body));
  }
  if (input.includeSignature !== undefined) {
    patch.include_signature = input.includeSignature;
  }
  if (input.purpose !== undefined) {
    patch.purpose = input.purpose;
  }
  const supabase = createClient();
  const { data, error } = await supabase
    .from('email_templates')
    .update(patch)
    .eq('id', input.templateId)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    if (error && isMissingRelation(error)) return migrationPendingError();
    return { ok: false, error: 'No se pudo actualizar la plantilla.' };
  }
  revalidatePath('/emails/templates');
  revalidatePath('/emails/compose');
  const listed = await listEmailTemplatesAction({ includeArchived: true });
  if (!listed.ok) return listed;
  const tpl = listed.templates.find((t) => t.id === input.templateId);
  if (!tpl) return { ok: false, error: 'Plantilla no encontrada.' };
  return { ok: true, template: tpl };
}

export async function deleteEmailTemplateAction(
  templateId: string
): Promise<{ ok: true } | ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  const supabase = createClient();
  // Desvincular borradores, no borrarlos
  await supabase
    .from('email_drafts')
    .update({ template_id: null })
    .eq('template_id', templateId);
  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', templateId);
  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    return { ok: false, error: 'No se pudo eliminar la plantilla.' };
  }
  revalidatePath('/emails/templates');
  revalidatePath('/emails/compose');
  return { ok: true };
}

export async function saveEmailAsTemplateAction(input: {
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  purpose: EmailPurpose;
  category?: string;
  templateId?: string | null;
}): Promise<ActionOk<{ template: EmailTemplateRow }> | ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  const name = input.name.trim();
  if (!name || name.length > 200) {
    return { ok: false, error: 'Nombre de plantilla no válido.' };
  }
  const html = sanitizeEmailHtml(input.htmlBody);
  const text = input.textBody || htmlToPlainText(html);
  const slugBase = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const slug = `${slugBase || 'plantilla'}-${randomUUID().slice(0, 8)}`;
  const supabase = createClient();

  if (input.templateId) {
    const { data, error } = await supabase
      .from('email_templates')
      .update({
        name,
        subject: input.subject.trim().slice(0, 500),
        html_body: html,
        text_body: text,
        purpose: input.purpose,
        category: input.category || 'personalizada',
        updated_by: access.profile.id,
      })
      .eq('id', input.templateId)
      .select(
        'id, slug, name, category, subject, html_body, text_body, purpose, variables, include_signature, status, system_key, updated_at'
      )
      .maybeSingle();
    if (error || !data) {
      if (error && isMissingRelation(error)) return migrationPendingError();
      return { ok: false, error: 'No se pudo actualizar la plantilla.' };
    }
    revalidatePath('/emails/templates');
    const listed = await listEmailTemplatesAction();
    if (!listed.ok) return listed;
    const tpl = listed.templates.find((t) => t.id === String(data.id));
    if (!tpl) return { ok: false, error: 'Plantilla no encontrada tras guardar.' };
    return { ok: true, template: tpl };
  }

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      slug,
      name,
      category: input.category || 'personalizada',
      subject: input.subject.trim().slice(0, 500),
      html_body: html,
      text_body: text,
      purpose: input.purpose,
      variables: [],
      include_signature: true,
      status: 'active',
      system_key: null,
      created_by: access.profile.id,
      updated_by: access.profile.id,
    })
    .select('id')
    .maybeSingle();
  if (error || !data) {
    if (error && isMissingRelation(error)) return migrationPendingError();
    console.error('[emails] insert template', error?.message);
    return { ok: false, error: 'No se pudo guardar la plantilla.' };
  }
  revalidatePath('/emails/templates');
  const listed = await listEmailTemplatesAction();
  if (!listed.ok) return listed;
  const tpl = listed.templates.find((t) => t.id === String(data.id));
  if (!tpl) return { ok: false, error: 'Plantilla no encontrada tras guardar.' };
  return { ok: true, template: tpl };
}

export async function updateEmailTemplateStatusAction(input: {
  templateId: string;
  status: 'active' | 'archived' | 'disabled';
}): Promise<{ ok: true } | ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  const supabase = createClient();
  const { error } = await supabase
    .from('email_templates')
    .update({ status: input.status, updated_by: access.profile.id })
    .eq('id', input.templateId);
  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    return { ok: false, error: 'No se pudo actualizar el estado.' };
  }
  revalidatePath('/emails/templates');
  revalidatePath('/emails/compose');
  return { ok: true };
}

export async function duplicateEmailTemplateAction(
  templateId: string
): Promise<ActionOk<{ template: EmailTemplateRow }> | ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  const listed = await listEmailTemplatesAction();
  if (!listed.ok) return listed;
  const src = listed.templates.find((t) => t.id === templateId);
  if (!src) return { ok: false, error: 'Plantilla no encontrada.' };
  return saveEmailAsTemplateAction({
    name: `${src.name} (copia)`,
    subject: src.subject,
    htmlBody: src.htmlBody,
    textBody: src.textBody,
    purpose: src.purpose,
    category: src.category,
  });
}

export async function sendCorporateEmailAction(input: {
  draftId?: string | null;
  idempotencyKey?: string | null;
  explicitConfirm?: boolean;
  purpose?: EmailPurpose;
  legalBasis?: EmailLegalBasis | null;
  commercialAuthAck?: boolean;
  oppositionChecked?: boolean;
  fromKey?: string | null;
  recipientEmail?: string;
  recipientName?: string | null;
  ccEmails?: string | string[] | null;
  bccEmails?: string | string[] | null;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  templateSlug?: string;
  previewOrigin?: string | null;
  includeSignature?: boolean;
  /** EMAIL-02: prueba visual de plantilla comercial (allowlist + [PRUEBA]). */
  visualTestSend?: boolean;
  /** EMAIL-04: confirmar envío solo con adjuntos. */
  allowAttachmentsOnly?: boolean;
}): Promise<
  | ActionOk<{
      sendId: string;
      status: string;
      dryRun: boolean;
      replay: boolean;
      providerMessageId: string | null;
      historyLabel: string;
      visualTestSend?: boolean;
    }>
  | ActionErr
> {
  const access = await requireEmailsAccess('send');
  if (!access.ok) {
    return {
      ok: false,
      code: 'forbidden',
      error: access.message || 'No autorizado a enviar.',
    };
  }
  const profileId = access.profile.id;

  const mode = getCorporateEmailSendMode();
  if (!mode.enabled) {
    return {
      ok: false,
      code: 'send_disabled',
      error:
        'El envío está desactivado (FF_CORPORATE_EMAIL_SEND_ENABLED). Puedes guardar el borrador.',
    };
  }

  // Envíos reales o prueba visual: allowlist obligatoria (To/CC/CCO).
  if (!mode.dryRun || input.visualTestSend === true) {
    if (!parseCorporateEmailTestRecipients()?.length) {
      return {
        ok: false,
        code: 'blocked',
        error:
          'Envío real/prueba bloqueado: configura FF_CORPORATE_EMAIL_TEST_RECIPIENTS.',
      };
    }
  }

  const supabase = createClient();
  let draft: EmailDraftRow | null = null;
  if (input.draftId) {
    const loaded = await getEmailDraftAction(input.draftId);
    if (!loaded.ok) return loaded;
    draft = loaded.draft;
  }

  const templateSlug =
    input.templateSlug || draft?.templateSlug || 'blank';
  const recipientEmail = (
    input.recipientEmail ??
    draft?.recipientEmail ??
    ''
  ).trim();
  const recipientName =
    input.recipientName !== undefined
      ? input.recipientName
      : draft?.recipientName ?? null;
  const ccRaw =
    input.ccEmails !== undefined
      ? input.ccEmails
      : draft?.ccEmails ?? [];
  const bccRaw =
    input.bccEmails !== undefined
      ? input.bccEmails
      : draft?.bccEmails ?? [];
  const recipients = normalizeRecipients({
    to: recipientEmail,
    cc: ccRaw,
    bcc: bccRaw,
  });
  if (!recipients.ok) {
    return { ok: false, code: 'blocked', error: recipients.error };
  }
  if (recipients.recipients.to.length !== 1) {
    return {
      ok: false,
      code: 'blocked',
      error: 'Indica exactamente un destinatario en Para.',
    };
  }
  const allowCheck = assertCorporateEmailRecipientsAllowed(
    recipients.recipients.all
  );
  if (!allowCheck.ok) {
    return { ok: false, code: 'blocked', error: allowCheck.error };
  }
  const visualTestSend = input.visualTestSend === true;
  let subject = (input.subject ?? draft?.subject ?? '').trim();
  if (visualTestSend && !/^\[PRUEBA\]/i.test(subject)) {
    subject = `[PRUEBA] ${subject || 'Plantilla comercial'}`.trim();
  }
  const htmlBodyRaw = sanitizeEmailHtml(
    input.htmlBody ?? draft?.htmlBody ?? ''
  );
  const textBodyRaw =
    input.textBody ?? draft?.textBody ?? htmlToPlainText(htmlBodyRaw);
  const requestedPurpose: EmailPurpose =
    input.purpose ?? draft?.purpose ?? 'operational';
  const purpose = resolveEffectivePurpose(
    templateSlug === 'custom' ? 'blank' : templateSlug,
    requestedPurpose
  );
  // Prueba visual: no inventar consentimiento comercial
  const legalBasis = visualTestSend
    ? null
    : input.legalBasis !== undefined
      ? input.legalBasis
      : draft?.legalBasis ?? null;
  const commercialAuthAck = visualTestSend
    ? false
    : input.commercialAuthAck ?? draft?.commercialAuthAck ?? false;
  const oppositionChecked = visualTestSend
    ? false
    : input.oppositionChecked ?? draft?.oppositionChecked ?? false;
  const fromKeyRaw =
    input.fromKey || draft?.fromKey || defaultCorporateSenderKey();
  const senderCheck = assertAuthorizedSenderKey(fromKeyRaw);
  if (!senderCheck.ok) {
    return { ok: false, code: 'blocked', error: senderCheck.error };
  }
  const sender = senderCheck.sender;

  // Firmas para Resend: siempre URLs HTTPS públicas (nunca localhost / origin del preview).
  const providerPayload = buildProviderEmailHtml({
    htmlBody: htmlBodyRaw,
    textBody: textBodyRaw,
    fromKey: sender.key,
    includeSignature: input.includeSignature === true,
  });
  const htmlBody = providerPayload.html;
  const textBody = providerPayload.text;

  const emailNorm = recipients.recipients.to[0];
  const allRecipients = recipients.recipients.all;
  const { data: suppressedRows, error: suppErr } = await supabase
    .from('email_suppression_list')
    .select('email')
    .in('email', allRecipients);
  if (suppErr && !isMissingRelation(suppErr)) {
    console.error('[emails] suppression check', suppErr.message);
  }
  const suppressedSet = new Set(
    (suppressedRows ?? []).map((r) =>
      String((r as { email: string }).email).toLowerCase()
    )
  );
  const recipientSuppressed = allRecipients.some((e) => suppressedSet.has(e));

  if (visualTestSend && purpose !== 'commercial') {
    return {
      ok: false,
      code: 'blocked',
      error:
        '«Enviar prueba» solo aplica a plantillas comerciales (demo/piloto). Usa Enviar normal para el resto.',
    };
  }

  let attachments: EmailDraftAttachmentRow[] = [];
  if (draft?.id) {
    const listed = await listDraftAttachmentsAction(draft.id);
    if (listed.ok) attachments = listed.attachments;
  }
  const attBatch = validateAttachmentBatch(
    attachments.map((a) => ({
      fileName: a.fileName,
      contentType: a.contentType,
      byteSize: a.byteSize,
    }))
  );
  if (!attBatch.ok) return { ok: false, error: attBatch.error };

  const contentGate = assertEmailHasAuthoredContent({
    htmlBody,
    textBody,
    attachmentCount: attachments.length,
  });
  if (
    !contentGate.ok &&
    !(
      contentGate.code === 'attachments_only' &&
      input.allowAttachmentsOnly === true
    )
  ) {
    return { ok: false, code: 'blocked', error: contentGate.error };
  }

  const policy = assertCorporateSendPolicy({
    purpose,
    templateSlug: templateSlug === 'custom' ? 'blank' : templateSlug,
    legalBasis,
    commercialAuthAck,
    oppositionChecked,
    recipientSuppressed,
    explicitConfirm: input.explicitConfirm === true,
    recipientEmail: emailNorm,
    subject,
    htmlBody,
    textBody,
    visualTestSend,
    attachmentCount: attachments.length,
    allowAttachmentsOnly: input.allowAttachmentsOnly === true,
  });
  if (!policy.ok) {
    return { ok: false, code: 'blocked', error: policy.error };
  }

  const fromAddress = sender.fromHeader;
  const replyTo = sender.replyTo;
  const hash = payloadHash({
    to: emailNorm,
    subject,
    html: htmlBody,
    text: textBody,
    purpose: policy.purpose,
    fromKey: sender.key,
    attachmentIds: attachments.map((a) => a.id).sort(),
  });
  // Idempotencia estable (anti doble-clic): mismo borrador + mismo payload → replay
  const idem =
    input.idempotencyKey?.trim() ||
    `ff-corp-${draft?.id || 'nodraft'}-${hash.slice(0, 32)}`;

  const claimArgs: Record<string, unknown> = {
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
    // Visual test: no inventar base jurídica comercial (check constraint
    // solo admite consent|legitimate_interest_documented|contractual).
    // Se registra como operativo + template_slug piloto/demo.
    p_purpose: visualTestSend ? 'operational' : policy.purpose,
    p_legal_basis: visualTestSend ? null : policy.legalBasis,
    p_payload_hash: hash,
    p_dry_run: mode.dryRun,
    p_attachment_count: attachments.length,
    p_confirmation_ack_at: new Date().toISOString(),
    p_from_key: sender.key,
    p_cc_emails: recipients.recipients.cc,
    p_bcc_emails: recipients.recipients.bcc,
    p_signature_included: providerPayload.signaturePresent,
    p_signature_label: providerPayload.signatureLabel,
  };

  let { data: claimData, error: claimErr } = await supabase.rpc(
    'ff_corporate_email_claim_send_v1',
    claimArgs
  );

  // Compatibilidad si 090 aún no está aplicada (sin params de firma)
  if (
    claimErr &&
    /p_signature_|could not find|unexpected|function.*does not exist|42883/i.test(
      claimErr.message || ''
    )
  ) {
    const legacyArgs = { ...claimArgs };
    delete legacyArgs.p_signature_included;
    delete legacyArgs.p_signature_label;
    const legacy = await supabase.rpc(
      'ff_corporate_email_claim_send_v1',
      legacyArgs
    );
    claimData = legacy.data;
    claimErr = legacy.error;
  }

  if (claimErr) {
    if (
      isMissingRelation(claimErr) ||
      /ff_corporate_email_claim/i.test(claimErr.message)
    ) {
      return {
        ok: false,
        code: 'migration_pending',
        error:
          'Falta la migración de envío (085/086). Aplícala en staging antes de probar el outbox.',
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
        error: 'No autorizado a enviar.',
      };
    }
    return { ok: false, error: 'No se pudo registrar el envío.' };
  }

  const claim = (claimData ?? {}) as Record<string, unknown>;
  const sendId = String(claim.id ?? '');
  const replay = Boolean(claim.replay);
  if (!sendId) {
    return { ok: false, error: 'No se pudo registrar el envío.' };
  }

  async function markDraftConsumedEarly() {
    if (!draft?.id) return;
    await supabase
      .from('email_drafts')
      .update({
        consumed_at: new Date().toISOString(),
        consumed_by_send_id: sendId,
        trashed_at: null,
        updated_by: profileId,
      })
      .eq('id', draft.id);
    revalidatePath('/emails/drafts');
  }

  if (replay && String(claim.status) === 'sent') {
    await markDraftConsumedEarly();
    const kind = resolveEmailHistoryKind({
      status: 'sent',
      providerStatus:
        claim.provider_status == null ? null : String(claim.provider_status),
      dryRun: Boolean(claim.dry_run),
      providerMessageId:
        claim.provider_message_id == null
          ? null
          : String(claim.provider_message_id),
    });
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
      historyLabel: emailHistoryLabel(kind, {
        dryRun: Boolean(claim.dry_run),
      }),
    };
  }

  // Copiar metadatos de adjuntos al envío
  if (attachments.length > 0) {
    const { error: attInsErr } = await supabase
      .from('email_send_attachments')
      .insert(
        attachments.map((a) => ({
          send_id: sendId,
          draft_id: draft?.id ?? null,
          file_name: a.fileName,
          content_type: a.contentType,
          byte_size: a.byteSize,
          storage_path: a.storagePath,
          sha256: a.sha256 || createHash('sha256').update(a.id).digest('hex'),
          source_kind: a.sourceKind,
          source_ref: {},
          created_by: profileId,
        }))
      );
    if (attInsErr) {
      console.error('[emails] send attachments meta', attInsErr.message);
    }
  }

  async function markDraftConsumed() {
    if (!draft?.id) return;
    const { error: consumeErr } = await supabase
      .from('email_drafts')
      .update({
        consumed_at: new Date().toISOString(),
        consumed_by_send_id: sendId,
        trashed_at: null,
        updated_by: profileId,
      })
      .eq('id', draft.id);
    if (consumeErr && !/consumed_at|consumed_by_send/i.test(consumeErr.message || '')) {
      console.error('[emails] consume draft', consumeErr.message);
    }
    revalidatePath('/emails/drafts');
    revalidatePath('/emails/trash');
  }

  if (mode.dryRun) {
    const simulatedProviderId = `dry-run-${sendId.slice(0, 8)}`;
    const { data: fin, error: finErr } = await supabase.rpc(
      'ff_corporate_email_finalize_send_v1',
      {
        p_send_id: sendId,
        p_status: 'sent',
        p_provider_message_id: simulatedProviderId,
        p_error: null,
        // CHECK DB solo admite accepted|delivered|… — null evita fingir aceptación Resend.
        p_provider_status: null,
      }
    );
    if (finErr) {
      console.error('[emails] finalize dry-run', finErr.message);
      return {
        ok: false,
        error: 'Envío simulado registrado, pero no se pudo cerrar el estado.',
      };
    }
    const finRow = (fin ?? {}) as Record<string, unknown>;
    await markDraftConsumed();
    revalidatePath('/emails');
    revalidatePath('/emails/sends');
    const kind = resolveEmailHistoryKind({
      status: String(finRow.status ?? 'sent'),
      providerStatus: null,
      dryRun: true,
      providerMessageId: simulatedProviderId,
    });
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
      historyLabel: emailHistoryLabel(kind, { dryRun: true }),
    };
  }

  const readiness = corporateEmailSendReadiness();
  if (readiness.missing.length > 0) {
    await supabase.rpc('ff_corporate_email_finalize_send_v1', {
      p_send_id: sendId,
      p_status: 'failed',
      p_provider_message_id: null,
      p_error: `Config incompleta: ${readiness.missing.join(', ')}`,
      p_provider_status: null,
    });
    return {
      ok: false,
      error: 'El envío no está configurado en el servidor.',
    };
  }

  // Descargar adjuntos de Storage para Resend
  const resendAttachments: Array<{ filename: string; content: string }> = [];
  for (const a of attachments) {
    const { data: blob, error: dlErr } = await supabase.storage
      .from('email-attachments')
      .download(a.storagePath);
    if (dlErr || !blob) {
      await supabase.rpc('ff_corporate_email_finalize_send_v1', {
        p_send_id: sendId,
        p_status: 'failed',
        p_provider_message_id: null,
        p_error: `Adjunto no disponible: ${a.fileName}`,
        p_provider_status: null,
      });
      return {
        ok: false,
        error: `No se pudo leer el adjunto «${a.fileName}».`,
      };
    }
    const ab = await blob.arrayBuffer();
    resendAttachments.push({
      filename: a.fileName,
      content: Buffer.from(ab).toString('base64'),
    });
  }

  const sendResult = await sendTransactionalEmail({
    to: emailNorm,
    subject,
    html: htmlBody,
    text: textBody,
    from: fromAddress,
    replyTo,
    cc: recipients.recipients.cc,
    bcc: recipients.recipients.bcc,
    attachments: resendAttachments,
  });

  if (!sendResult.ok) {
    await supabase.rpc('ff_corporate_email_finalize_send_v1', {
      p_send_id: sendId,
      p_status: 'failed',
      p_provider_message_id: null,
      p_error: sendResult.error,
      p_provider_status: null,
    });
    revalidatePath('/emails/sends');
    return { ok: false, error: sendResult.error };
  }

  // Aceptado por Resend ≠ entregado
  await supabase.rpc('ff_corporate_email_finalize_send_v1', {
    p_send_id: sendId,
    p_status: 'sent',
    p_provider_message_id: sendResult.id ?? null,
    p_error: null,
    p_provider_status: 'accepted',
  });

  await markDraftConsumed();
  revalidatePath('/emails');
  revalidatePath('/emails/sends');
  const kind = resolveEmailHistoryKind({
    status: 'sent',
    providerStatus: 'accepted',
    dryRun: false,
  });
  return {
    ok: true,
    sendId,
    status: 'sent',
    dryRun: false,
    replay,
    providerMessageId: sendResult.id ?? null,
    historyLabel: emailHistoryLabel(kind),
  };
}
