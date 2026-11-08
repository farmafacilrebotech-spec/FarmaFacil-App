import Link from 'next/link';

import { listEmailDraftsAction } from '@/app/(app)/emails/actions';
import { DraftsDeleteButton } from '@/components/email/drafts-delete-button';
import { PageHeader } from '@/components/shared/page-header';
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
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm">
            <Link
              href="/emails"
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              ← Emails corporativos
            </Link>
          </div>
          <PageHeader
            title="Borradores"
            description="Recuperar, editar o eliminar borradores corporativos."
          />
        </div>
        <Button asChild>
          <Link href="/emails/compose">Nuevo email</Link>
        </Button>
      </div>

      {!listed.ok ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium">{listed.error}</p>
          {listed.code === 'migration_pending' ? (
            <p className="mt-2 text-muted-foreground">
              La UI de redacción en{' '}
              <Link href="/emails/compose" className="underline">
                /emails/compose
              </Link>{' '}
              funciona sin persistencia hasta aplicar 075.
            </p>
          ) : null}
        </div>
      ) : listed.drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay borradores guardados.{' '}
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
    </div>
  );
}
