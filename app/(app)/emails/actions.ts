'use server';

import { revalidatePath } from 'next/cache';

import {
  buildComposeSeed,
  isEmailTemplateSlug,
  type EmailTemplateSlug,
} from '@/lib/email/compose-catalog';
import {
  assertCorporateSendBlocked,
  validateEmailDraftInput,
  type EmailDraftInput,
} from '@/lib/email/draft-validation';
import { requireEmailsAccess } from '@/lib/email/require-emails-access';
import { createClient } from '@/lib/supabase/server';

export type EmailDraftRow = {
  id: string;
  templateSlug: EmailTemplateSlug;
  subject: string;
  htmlBody: string;
  textBody: string;
  recipientEmail: string;
  recipientName: string | null;
  createdBy: string;
  updatedAt: string;
  createdAt: string;
};

type ActionOk<T> = { ok: true } & T;
type ActionErr = { ok: false; error: string; code?: 'migration_pending' | 'forbidden' };

function mapDraftRow(row: Record<string, unknown>): EmailDraftRow {
  const slug = String(row.template_slug ?? 'blank');
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
    createdBy: String(row.created_by ?? ''),
    updatedAt: String(row.updated_at ?? ''),
    createdAt: String(row.created_at ?? ''),
  };
}

function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    msg.includes('email_drafts') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist')
  );
}

function migrationPendingError(): ActionErr {
  return {
    ok: false,
    code: 'migration_pending',
    error:
      'Los borradores requieren la migración 075 (email_drafts). Aún no está aplicada. Puedes redactar y previsualizar; guardar quedará disponible tras autorizar 075.',
  };
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
    .select(
      'id, template_slug, subject, html_body, text_body, recipient_email, recipient_name, created_by, created_at, updated_at'
    )
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
    .select(
      'id, template_slug, subject, html_body, text_body, recipient_email, recipient_name, created_by, created_at, updated_at'
    )
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
    return { ok: false, code: 'forbidden', error: 'No autorizado a guardar borradores.' };
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
    updated_by: access.profile.id,
  };

  if (draft.id) {
    const { data, error } = await supabase
      .from('email_drafts')
      .update(payload)
      .eq('id', draft.id)
      .select(
        'id, template_slug, subject, html_body, text_body, recipient_email, recipient_name, created_by, created_at, updated_at'
      )
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
    .select(
      'id, template_slug, subject, html_body, text_body, recipient_email, recipient_name, created_by, created_at, updated_at'
    )
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
 * Envío explícitamente bloqueado en Fase A (arquitectura lista en 075/email_sends).
 */
export async function sendCorporateEmailAction(_input: {
  draftId?: string | null;
  idempotencyKey?: string | null;
}): Promise<ActionErr> {
  const access = await requireEmailsAccess('write');
  if (!access.ok) {
    return { ok: false, code: 'forbidden', error: 'No autorizado.' };
  }
  void _input;
  return assertCorporateSendBlocked();
}
