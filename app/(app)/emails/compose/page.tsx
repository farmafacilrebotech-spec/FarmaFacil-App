import Link from 'next/link';
import { headers } from 'next/headers';

import { EmailComposer } from '@/components/email/email-composer';
import { PageHeader } from '@/components/shared/page-header';
import { getEmailDraftAction } from '@/app/(app)/emails/actions';
import { buildComposeSeed, type EmailTemplateSlug } from '@/lib/email/compose-catalog';
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

  let initial = {
    id: null as string | null,
    templateSlug: 'blank' as EmailTemplateSlug,
    subject: '',
    htmlBody: '',
    textBody: '',
    recipientEmail: '',
    recipientName: '',
    from: '',
    replyTo: '',
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
      };
    } else if (loaded.code !== 'migration_pending') {
      // draft missing → blank with message via empty state
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
        description="Redacción y vista previa. Envío bloqueado hasta autorización."
      />
      <EmailComposer initial={initial} />
    </div>
  );
}
