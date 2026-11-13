import Link from 'next/link';

import {
  listEmailDraftsAction,
  listEmailTemplatesAction,
} from '@/app/(app)/emails/actions';
import { DraftsMailbox } from '@/components/email/drafts-mailbox';
import { EmailsShell } from '@/components/email/emails-shell';
import { buildDraftTemplateTitleMap } from '@/lib/email/draft-template-titles';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';

export const dynamic = 'force-dynamic';

export default async function EmailDraftsPage() {
  await assertEmailsPageAccess();
  const [listed, templatesListed] = await Promise.all([
    listEmailDraftsAction(),
    listEmailTemplatesAction({ includeArchived: true }),
  ]);

  const templates = templatesListed.ok ? templatesListed.templates : [];
  const drafts = listed.ok ? listed.drafts : [];
  const templateTitles = buildDraftTemplateTitleMap(drafts, templates);

  return (
    <EmailsShell title="Borradores">
      {!listed.ok ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium">{listed.error}</p>
        </div>
      ) : listed.drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay borradores.{' '}
          <Link href="/emails/compose" className="underline">
            Crear uno
          </Link>
          .
        </p>
      ) : (
        <DraftsMailbox drafts={listed.drafts} templateTitles={templateTitles} />
      )}
    </EmailsShell>
  );
}
