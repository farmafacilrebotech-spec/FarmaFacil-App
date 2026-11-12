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

type SearchParams = { draft?: string; templateId?: string };

export default async function EmailComposePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await assertEmailsPageAccess();

  const draftId = searchParams?.draft?.trim() || null;
  const templateIdParam = searchParams?.templateId?.trim() || null;
  const defaultSender = getCorporateSender(defaultCorporateSenderKey());
  const listedTemplates = await listEmailTemplatesAction();
  const activeTemplates = listedTemplates.ok ? listedTemplates.templates : [];

  let initial = {
    id: null as string | null,
    templateSlug: 'blank',
    templateId: null as string | null,
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
  };

  if (draftId) {
    const loaded = await getEmailDraftAction(draftId);
    if (loaded.ok) {
      const sender = getCorporateSender(loaded.draft.fromKey);
      initial = {
        id: loaded.draft.id,
        templateSlug: loaded.draft.templateSlug,
        templateId: loaded.draft.templateId,
        subject: loaded.draft.subject,
        htmlBody: extractComposerEditableHtml(
          loaded.draft.htmlBody || '<p><br/></p>'
        ),
        textBody: loaded.draft.textBody,
        recipientEmail: loaded.draft.recipientEmail,
        recipientName: loaded.draft.recipientName ?? '',
        ccEmails: loaded.draft.ccEmails.join(', '),
        bccEmails: loaded.draft.bccEmails.join(', '),
        fromKey: sender.key,
        from: sender.fromHeader,
        replyTo: sender.replyTo,
        purpose: loaded.draft.purpose,
      };
    }
  } else if (templateIdParam) {
    const tpl = activeTemplates.find((t) => t.id === templateIdParam);
    if (tpl) {
      const body = extractComposerEditableHtml(
        tpl.htmlBody || '<p><br/></p>'
      );
      initial = {
        ...initial,
        templateSlug: tpl.systemKey || 'custom',
        templateId: tpl.id,
        subject: tpl.subject,
        htmlBody: body,
        textBody: tpl.textBody,
        purpose: tpl.purpose,
      };
      void htmlHasEmbeddedSignature(body);
    }
  }

  return (
    <EmailsShell title={initial.id ? 'Editar borrador' : 'Nuevo email'}>
      <EmailComposer initial={initial} initialTemplates={activeTemplates} />
    </EmailsShell>
  );
}
