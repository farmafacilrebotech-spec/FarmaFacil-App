import Link from 'next/link';
import { headers } from 'next/headers';

import { EmailComposer } from '@/components/email/email-composer';
import { PageHeader } from '@/components/shared/page-header';
import { getEmailDraftAction } from '@/app/(app)/emails/actions';
import {
  buildComposeSeed,
  type EmailTemplateSlug,
} from '@/lib/email/compose-catalog';
import { defaultPurposeForTemplate } from '@/lib/email/corporate-send-policy';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';
import { requestPublicOriginFromHeaders } from '@/lib/auth/request-origin';
import { CANONICAL_PRODUCTION_APP_URL } from '@/lib/auth/app-url';
import { normalizeFfPreviewOrigin } from '@/lib/email/corporate-templates';

export const dynamic = 'force-dynamic';

type SearchParams = { draft?: string; template?: string };

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

  let initial: {
    id: string | null;
    templateSlug: EmailTemplateSlug;
    subject: string;
    htmlBody: string;
    textBody: string;
    recipientEmail: string;
    recipientName: string;
    from: string;
    replyTo: string;
    purpose: 'operational' | 'commercial';
    legalBasis: '' | 'consent' | 'legitimate_interest_documented' | 'contractual';
    commercialAuthAck: boolean;
    oppositionChecked: boolean;
  } = {
    id: null,
    templateSlug: 'blank',
    subject: '',
    htmlBody: '',
    textBody: '',
    recipientEmail: '',
    recipientName: '',
    from: '',
    replyTo: '',
    purpose: 'operational',
    legalBasis: '',
    commercialAuthAck: false,
    oppositionChecked: false,
  };

  if (draftId) {
    const loaded = await getEmailDraftAction(draftId);
    if (loaded.ok) {
      const seed = buildComposeSeed(loaded.draft.templateSlug, {
        previewOrigin: origin,
      });
      initial = {
        id: loaded.draft.id,
        templateSlug: loaded.draft.templateSlug,
        subject: loaded.draft.subject,
        htmlBody: loaded.draft.htmlBody,
        textBody: loaded.draft.textBody,
        recipientEmail: loaded.draft.recipientEmail,
        recipientName: loaded.draft.recipientName ?? '',
        from: seed.from,
        replyTo: seed.replyTo,
        purpose: loaded.draft.purpose,
        legalBasis: loaded.draft.legalBasis ?? '',
        commercialAuthAck: loaded.draft.commercialAuthAck,
        oppositionChecked: loaded.draft.oppositionChecked,
      };
    }
  } else {
    const slug = (
      ['blank', 'lanzadera', 'imprentas', 'demo', 'piloto'] as const
    ).includes(templateParam as EmailTemplateSlug)
      ? (templateParam as EmailTemplateSlug)
      : 'blank';
    const seed = buildComposeSeed(slug, { previewOrigin: origin });
    initial = {
      id: null,
      templateSlug: seed.templateSlug,
      subject: seed.subject,
      htmlBody: seed.htmlBody,
      textBody: seed.textBody,
      recipientEmail: '',
      recipientName: '',
      from: seed.from,
      replyTo: seed.replyTo,
      purpose: defaultPurposeForTemplate(slug),
      legalBasis: '',
      commercialAuthAck: false,
      oppositionChecked: false,
    };
  }

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-6">
      <div className="text-sm">
        <Link
          href="/emails"
          className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          ← Emails corporativos
        </Link>
      </div>
      <PageHeader
        title={initial.id ? 'Editar borrador' : 'Nuevo email'}
        description="Redacción, vista previa y envío 1:1 (flag servidor; dry-run por defecto)."
      />
      <EmailComposer initial={initial} />
    </div>
  );
}
