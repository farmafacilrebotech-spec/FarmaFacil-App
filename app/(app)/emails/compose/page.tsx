import { headers } from 'next/headers';

import { EmailComposer } from '@/components/email/email-composer';
import { EmailsShell } from '@/components/email/emails-shell';
import {
  getEmailDraftAction,
  listEmailTemplatesAction,
} from '@/app/(app)/emails/actions';
import {
  buildComposeSeed,
  type EmailTemplateSlug,
} from '@/lib/email/compose-catalog';
import { defaultPurposeForTemplate } from '@/lib/email/corporate-send-policy';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';
import { requestPublicOriginFromHeaders } from '@/lib/auth/request-origin';
import { CANONICAL_PRODUCTION_APP_URL } from '@/lib/auth/app-url';
import { normalizeFfPreviewOrigin } from '@/lib/email/corporate-templates';
import {
  defaultCorporateSenderKey,
  getCorporateSender,
} from '@/lib/email/senders';

export const dynamic = 'force-dynamic';

type SearchParams = { draft?: string; template?: string; templateId?: string };

export default async function EmailComposePage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await assertEmailsPageAccess();

  const h = headers();
  const origin = normalizeFfPreviewOrigin(
    requestPublicOriginFromHeaders(h, CANONICAL_PRODUCTION_APP_URL)
  );

  const draftId = searchParams?.draft?.trim() || null;
  const templateParam = searchParams?.template?.trim() || 'blank';
  const templateIdParam = searchParams?.templateId?.trim() || null;
  const defaultSender = getCorporateSender(defaultCorporateSenderKey());

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
    legalBasis: '' as
      | ''
      | 'consent'
      | 'legitimate_interest_documented'
      | 'contractual',
    commercialAuthAck: false,
    oppositionChecked: false,
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
        htmlBody: loaded.draft.htmlBody || '<p><br/></p>',
        textBody: loaded.draft.textBody,
        recipientEmail: loaded.draft.recipientEmail,
        recipientName: loaded.draft.recipientName ?? '',
        ccEmails: loaded.draft.ccEmails.join(', '),
        bccEmails: loaded.draft.bccEmails.join(', '),
        fromKey: sender.key,
        from: sender.fromHeader,
        replyTo: sender.replyTo,
        purpose: loaded.draft.purpose,
        legalBasis: loaded.draft.legalBasis ?? '',
        commercialAuthAck: loaded.draft.commercialAuthAck,
        oppositionChecked: loaded.draft.oppositionChecked,
      };
    }
  } else if (templateIdParam) {
    const listed = await listEmailTemplatesAction();
    if (listed.ok) {
      const tpl = listed.templates.find((t) => t.id === templateIdParam);
      if (tpl) {
        initial = {
          ...initial,
          templateSlug: tpl.systemKey || 'custom',
          templateId: tpl.id,
          subject: tpl.subject,
          htmlBody: tpl.htmlBody || '<p><br/></p>',
          textBody: tpl.textBody,
          purpose: tpl.purpose,
        };
      }
    }
  } else if (templateParam && templateParam !== 'blank') {
    const slug = (
      ['lanzadera', 'imprentas', 'demo', 'piloto'] as const
    ).includes(templateParam as EmailTemplateSlug)
      ? (templateParam as EmailTemplateSlug)
      : 'blank';
    if (slug !== 'blank') {
      const seed = buildComposeSeed(slug, { previewOrigin: origin });
      initial = {
        ...initial,
        templateSlug: seed.templateSlug,
        subject: seed.subject,
        htmlBody: seed.htmlBody,
        textBody: seed.textBody,
        purpose: defaultPurposeForTemplate(slug),
      };
    }
  }

  return (
    <EmailsShell
      title={initial.id ? 'Editar borrador' : 'Nuevo email'}
      description="Redacción compacta · confirmación antes de enviar"
    >
      <EmailComposer initial={initial} />
    </EmailsShell>
  );
}
