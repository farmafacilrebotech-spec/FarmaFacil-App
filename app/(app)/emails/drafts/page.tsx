import Link from 'next/link';

import { listEmailDraftsAction } from '@/app/(app)/emails/actions';
import { DraftsDeleteButton } from '@/components/email/drafts-delete-button';
import { EmailsShell } from '@/components/email/emails-shell';
import { Button } from '@/components/ui/button';
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
      description="Recuperar, editar o eliminar borradores (con adjuntos)."
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
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-soft">
          {listed.drafts.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {d.subject || '(Sin asunto)'}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {templateTitle(d.templateSlug)}
                  {d.recipientEmail
                    ? ` · ${d.recipientEmail}`
                    : ' · sin destinatario'}
                  {d.ccEmails.length
                    ? ` · CC ${d.ccEmails.length}`
                    : ''}
                  {' · '}
                  {new Date(d.updatedAt).toLocaleString('es-ES')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/emails/compose?draft=${d.id}`}>Editar</Link>
                </Button>
                <DraftsDeleteButton draftId={d.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </EmailsShell>
  );
}
