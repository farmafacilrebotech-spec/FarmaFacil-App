import Link from 'next/link';

import { listEmailSendsAction } from '@/app/(app)/emails/actions';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';

export const dynamic = 'force-dynamic';

function statusLabel(status: string, dryRun: boolean): string {
  const base =
    status === 'sent'
      ? 'Enviado'
      : status === 'failed'
        ? 'Error'
        : status === 'queued'
          ? 'En cola'
          : status === 'blocked'
            ? 'Bloqueado'
            : status === 'cancelled'
              ? 'Cancelado'
              : status;
  return dryRun ? `${base} (dry-run)` : base;
}

export default async function EmailSendsPage() {
  await assertEmailsPageAccess();
  const listed = await listEmailSendsAction();

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
            title="Historial de envíos"
            description="Outbox e idempotencia Resend (1:1). Incluye dry-runs y errores."
          />
        </div>
        <Button asChild>
          <Link href="/emails/compose">Nuevo email</Link>
        </Button>
      </div>

      {!listed.ok ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium">{listed.error}</p>
        </div>
      ) : listed.sends.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay envíos registrados.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-soft">
          {listed.sends.map((s) => (
            <li key={s.id} className="space-y-1 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="truncate font-medium">
                  {s.subject || '(Sin asunto)'}
                </p>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {statusLabel(s.status, s.dryRun)}
                </span>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {s.purpose === 'commercial' ? 'Comercial' : 'Operativa'}
                {' · '}
                {s.recipientEmail}
                {' · '}
                {s.templateSlug}
                {' · '}
                {new Date(s.createdAt).toLocaleString('es-ES')}
              </p>
              {s.error ? (
                <p className="text-sm text-destructive">{s.error}</p>
              ) : null}
              {s.providerMessageId ? (
                <p className="text-xs text-muted-foreground">
                  Provider id: {s.providerMessageId}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
