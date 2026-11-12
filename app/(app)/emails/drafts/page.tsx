import Link from 'next/link';

import { listEmailDraftsAction } from '@/app/(app)/emails/actions';
import { DraftsMailbox } from '@/components/email/drafts-mailbox';
import { EmailsShell } from '@/components/email/emails-shell';
import { EMAIL_TEMPLATE_OPTIONS } from '@/lib/email/compose-catalog';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';

export const dynamic = 'force-dynamic';

function templateTitle(slug: string): string {
  return EMAIL_TEMPLATE_OPTIONS.find((t) => t.slug === slug)?.title ?? slug;
}

export default async function EmailDraftsPage() {
  await assertEmailsPageAccess();
  const listed = await listEmailDraftsAction();

  return (
    <EmailsShell
      title="Borradores"
      description="Recuperar, editar o eliminar borradores (con adjuntos y CC/CCO)."
    >
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
        <DraftsMailbox
          drafts={listed.drafts}
          templateTitle={templateTitle}
        />
      )}
    </EmailsShell>
  );
}
