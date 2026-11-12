import { EmailComposer } from '@/components/email/email-composer';
import { EmailsShell } from '@/components/email/emails-shell';
import {
  getEmailDraftAction,
  listEmailTemplatesAction,
} from '@/app/(app)/emails/actions';
import { extractComposerEditableHtml } from '@/lib/email/html-sanitize';
import { htmlHasEmbeddedSignature } from '@/lib/email/signature';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';
import {
  defaultCorporateSenderKey,
  getCorporateSender,
} from '@/lib/email/senders';

export const dynamic = 'force-dynamic';

type SearchParams = {
  draft?: string;
  templateId?: string;
  editTemplate?: string;
  newTemplate?: string;
};

export default async function EmailComposePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await assertEmailsPageAccess();

  const draftId = searchParams?.draft?.trim() || null;
  const templateIdParam = searchParams?.templateId?.trim() || null;
  const editTemplateId = searchParams?.editTemplate?.trim() || null;
  const newTemplate = searchParams?.newTemplate === '1';
  const defaultSender = getCorporateSender(defaultCorporateSenderKey());
  const listedTemplates = await listEmailTemplatesAction({
    includeArchived: Boolean(editTemplateId),
  });
  const allTemplates = listedTemplates.ok ? listedTemplates.templates : [];
  const activeTemplates = allTemplates.filter((t) => t.status === 'active');

  let mode: 'compose' | 'edit-template' | 'new-template' = 'compose';
  if (editTemplateId) mode = 'edit-template';
  else if (newTemplate) mode = 'new-template';

  let initial = {
    id: null as string | null,
    templateSlug: 'blank',
    templateId: null as string | null,
    templateName: '',
    subject: '',
    htmlBody: '<p><br/></p>',
    textBody: '',
    recipientEmail: '',
    recipientName: '',
    ccEmails: '',
    bccEmails: '',
    fromKey: defaultSender.key,
    from: defaultSender.fromHeader,
    replyTo: defaultSender.replyTo,
    purpose: 'operational' as 'operational' | 'commercial',
    includeSignature: true,
  };

  let title = 'Nuevo email';

  if (mode === 'edit-template' && editTemplateId) {
    const tpl = allTemplates.find((t) => t.id === editTemplateId);
    if (tpl) {
      const body = extractComposerEditableHtml(tpl.htmlBody || '<p><br/></p>');
      const hasEmbedded = htmlHasEmbeddedSignature(body);
      initial = {
        ...initial,
        templateSlug: tpl.systemKey || 'custom',
        templateId: tpl.id,
        templateName: tpl.name,
        subject: tpl.subject,
        htmlBody: body,
        textBody: tpl.textBody,
        purpose: tpl.purpose,
        includeSignature: hasEmbedded ? false : tpl.includeSignature !== false,
      };
      title = 'Editar plantilla';
    }
  } else if (mode === 'new-template') {
    title = 'Nueva plantilla';
    initial = {
      ...initial,
      templateName: '',
      includeSignature: true,
    };
  } else if (draftId) {
    const loaded = await getEmailDraftAction(draftId);
    if (loaded.ok) {
      const sender = getCorporateSender(loaded.draft.fromKey);
      const body = extractComposerEditableHtml(
        loaded.draft.htmlBody || '<p><br/></p>'
      );
      initial = {
        ...initial,
        id: loaded.draft.id,
        templateSlug: loaded.draft.templateSlug,
        templateId: loaded.draft.templateId,
        subject: loaded.draft.subject,
        htmlBody: body,
        textBody: loaded.draft.textBody,
        recipientEmail: loaded.draft.recipientEmail,
        recipientName: loaded.draft.recipientName ?? '',
        ccEmails: loaded.draft.ccEmails.join(', '),
        bccEmails: loaded.draft.bccEmails.join(', '),
        fromKey: sender.key,
        from: sender.fromHeader,
        replyTo: sender.replyTo,
        purpose: loaded.draft.purpose,
        includeSignature: !htmlHasEmbeddedSignature(body),
      };
      title = 'Editar borrador';
    }
  } else if (templateIdParam) {
    const tpl = activeTemplates.find((t) => t.id === templateIdParam);
    if (tpl) {
      const body = extractComposerEditableHtml(tpl.htmlBody || '<p><br/></p>');
      initial = {
        ...initial,
        templateSlug: tpl.systemKey || 'custom',
        templateId: tpl.id,
        templateName: tpl.name,
        subject: tpl.subject,
        htmlBody: body,
        textBody: tpl.textBody,
        purpose: tpl.purpose,
        includeSignature: htmlHasEmbeddedSignature(body)
          ? false
          : tpl.includeSignature !== false,
      };
    }
  }

  return (
    <EmailsShell title={title}>
      <EmailComposer
        mode={mode}
        initial={initial}
        initialTemplates={activeTemplates}
      />
    </EmailsShell>
  );
}
