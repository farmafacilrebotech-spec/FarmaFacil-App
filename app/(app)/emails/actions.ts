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
  resolveEffectivePurpose,
  type EmailLegalBasis,
  type EmailPurpose,
} from '@/lib/email/corporate-send-policy';
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
  assertCorporateSendBlocked,
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
  assertAuthorizedSenderKey,
  defaultCorporateSenderKey,
  getCorporateSender,
  listAuthorizedSenders,
  type CorporateSender,
  type CorporateSenderKey,
} from '@/lib/email/senders';
import { appendSignatureIfNeeded } from '@/lib/email/signature';
import { createClient } from '@/lib/supabase/server';

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
  subject: string;
  htmlBody: string;
  textBody: string;
  recipientEmail: string;
  recipientName: string | null;
  purpose: EmailPurpose;
  legalBasis: EmailLegalBasis | null;
  commercialAuthAck: boolean;
  oppositionChecked: boolean;
  fromKey: EmailFromKey;
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
  fromAddress: string;
  fromKey: string;
  templateSlug: string;
  dryRun: boolean;
  error: string | null;
  providerMessageId: string | null;
  providerStatus: string | null;
  attachmentCount: number;
  createdBy: string | null;
  createdByLabel: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  bouncedAt: string | null;
  historyKind: EmailHistoryKind;
  historyLabel: string;
};

type ActionOk<T> = { ok: true } & T;
type ActionErr = {
  ok: false;
  error: string;
  code?: 'migration_pending' | 'forbidden' | 'send_disabled' | 'blocked';
};

const DRAFT_SELECT =
  'id, template_slug, subject, html_body, text_body, recipient_email, recipient_name, purpose, legal_basis, commercial_auth_ack, opposition_checked, from_key, created_by, created_at, updated_at';

const ATTACH_SELECT =
  'id, draft_id, file_name, content_type, byte_size, storage_path, sha256, source_kind, created_at';

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
    ] as const
  ).includes(fromRaw as EmailFromKey)
    ? (fromRaw as EmailFromKey)
    : 'pilar';
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
  profileLabel?: string | null
): EmailSendRow {
  const purposeRaw = String(row.purpose ?? 'operational');
  const historyKind = resolveEmailHistoryKind({
    status: String(row.status ?? ''),
    providerStatus:
      row.provider_status == null ? null : String(row.provider_status),
    dryRun: Boolean(row.dry_run),
    bouncedAt: row.bounced_at == null ? null : String(row.bounced_at),
    deliveredAt: row.delivered_at == null ? null : String(row.delivered_at),
  });
  return {
    id: String(row.id),
    status: String(row.status ?? ''),
    purpose: purposeRaw === 'commercial' ? 'commercial' : 'operational',
    subject: String(row.subject ?? ''),
    recipientEmail: String(row.recipient_email ?? ''),
    fromAddress: String(row.from_address ?? ''),
    fromKey: String(row.from_key ?? 'pilar'),
    templateSlug: String(row.template_slug ?? 'blank'),
    dryRun: Boolean(row.dry_run),
    error: row.error == null ? null : String(row.error),
    providerMessageId:
      row.provider_message_id == null
        ? null
        : String(row.provider_message_id),
    providerStatus:
      row.provider_status == null ? null : String(row.provider_status),
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
  const defaultSender = getCorporateSender('pilar');
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
    fromAddress: process.env.EMAIL_FROM?.trim() || defaultSender.fromHeader,
    replyTo: defaultSender.replyTo,
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
      'id, status, purpose, subject, recipient_email, from_address, from_key, template_slug, dry_run, error, provider_message_id, provider_status, attachment_count, created_by, created_at, sent_at, delivered_at, bounced_at'
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingRelation(error)) return migrationPendingError();
    console.error('[emails] list sends', error.code, error.message);
    return { ok: false, error: 'No se pudo cargar el historial de envíos.' };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const userIds = [
    ...new Set(
      rows
        .map((r) => (r.created_by == null ? null : String(r.created_by)))
        .filter((v): v is string => Boolean(v))
    ),
  ];
  const labelById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    for (const p of profiles ?? []) {
      const row = p as { id: string; full_name?: string | null; email?: string | null };
      labelById.set(
        row.id,
        (row.full_name || row.email || row.id.slice(0, 8)).trim()
      );
    }
  }

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
  const purpose = resolveEffectivePurpose(draft.templateSlug, draft.purpose);
  const supabase = createClient();
  const payload = {
    template_slug: draft.templateSlug,
    subject: draft.subject,
    html_body: draft.htmlBody,
    text_body: draft.textBody,
    recipient_email: draft.recipientEmail,
    recipient_name: draft.recipientName,
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
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  templateSlug?: string;
  previewOrigin?: string | null;
}): Promise<
  | ActionOk<{
      sendId: string;
      status: string;
      dryRun: boolean;
      replay: boolean;
      providerMessageId: string | null;
      historyLabel: string;
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
  const subject = (input.subject ?? draft?.subject ?? '').trim();
  const htmlBodyRaw = input.htmlBody ?? draft?.htmlBody ?? '';
  const textBodyRaw = input.textBody ?? draft?.textBody ?? '';
  const requestedPurpose: EmailPurpose =
    input.purpose ?? draft?.purpose ?? 'operational';
  const purpose = resolveEffectivePurpose(templateSlug, requestedPurpose);
  const legalBasis =
    input.legalBasis !== undefined
      ? input.legalBasis
      : draft?.legalBasis ?? null;
  const commercialAuthAck =
    input.commercialAuthAck ?? draft?.commercialAuthAck ?? false;
  const oppositionChecked =
    input.oppositionChecked ?? draft?.oppositionChecked ?? false;
  const fromKeyRaw =
    input.fromKey || draft?.fromKey || defaultCorporateSenderKey();
  const senderCheck = assertAuthorizedSenderKey(fromKeyRaw);
  if (!senderCheck.ok) {
    return { ok: false, code: 'blocked', error: senderCheck.error };
  }
  const sender = senderCheck.sender;

  const withSig = appendSignatureIfNeeded({
    htmlBody: htmlBodyRaw,
    textBody: textBodyRaw,
    fromKey: sender.key,
    previewOrigin: input.previewOrigin,
  });
  const htmlBody = withSig.html;
  const textBody = withSig.text;

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
    templateSlug,
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

  const fromAddress = sender.fromHeader;
  const replyTo = sender.replyTo;
  const idem =
    input.idempotencyKey?.trim() ||
    `ff-corp-${draft?.id || 'nodraft'}-${randomUUID()}`;
  const hash = payloadHash({
    to: emailNorm,
    subject,
    html: htmlBody,
    text: textBody,
    purpose: policy.purpose,
    fromKey: sender.key,
    attachmentIds: attachments.map((a) => a.id).sort(),
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
      p_purpose: policy.purpose,
      p_legal_basis: policy.legalBasis,
      p_payload_hash: hash,
      p_dry_run: mode.dryRun,
      p_attachment_count: attachments.length,
      p_confirmation_ack_at: new Date().toISOString(),
      p_from_key: sender.key,
    }
  );

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

  if (replay && String(claim.status) === 'sent') {
    const kind = resolveEmailHistoryKind({
      status: 'sent',
      providerStatus:
        claim.provider_status == null ? null : String(claim.provider_status),
      dryRun: Boolean(claim.dry_run),
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
          created_by: access.profile.id,
        }))
      );
    if (attInsErr) {
      console.error('[emails] send attachments meta', attInsErr.message);
    }
  }

  if (mode.dryRun) {
    const { data: fin, error: finErr } = await supabase.rpc(
      'ff_corporate_email_finalize_send_v1',
      {
        p_send_id: sendId,
        p_status: 'sent',
        p_provider_message_id: `dry-run-${sendId.slice(0, 8)}`,
        p_error: null,
        p_provider_status: 'accepted',
      }
    );
    if (finErr) {
      console.error('[emails] finalize dry-run', finErr.message);
      return {
        ok: false,
        error: 'Envío de prueba registrado, pero no se pudo cerrar el estado.',
      };
    }
    const finRow = (fin ?? {}) as Record<string, unknown>;
    revalidatePath('/emails');
    revalidatePath('/emails/sends');
    const kind = resolveEmailHistoryKind({
      status: String(finRow.status ?? 'sent'),
      providerStatus: 'accepted',
      dryRun: true,
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
