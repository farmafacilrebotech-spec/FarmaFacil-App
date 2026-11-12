import Link from 'next/link';

import { listEmailSendsAction } from '@/app/(app)/emails/actions';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';
import { getCorporateSender } from '@/lib/email/senders';

export const dynamic = 'force-dynamic';

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
            description="Estados: borrador (en lista de borradores), pendiente, enviado a Resend, entregado (solo con confirmación del proveedor), error, rebotado o bloqueado. Aceptado por Resend no implica entregado."
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
          {listed.sends.map((s) => {
            const sender = getCorporateSender(s.fromKey);
            return (
              <li key={s.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="truncate font-medium">
                    {s.subject || '(Sin asunto)'}
                  </p>
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {s.historyLabel}
                  </span>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  Para: {s.recipientEmail}
                  {' · '}
                  De: {sender.email}
                  {' · '}
                  {s.purpose === 'commercial' ? 'Comercial' : 'Operativa'}
                  {' · '}
                  {new Date(s.createdAt).toLocaleString('es-ES')}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Enviado por: {s.createdByLabel || '—'}
                  {' · '}
                  Adjuntos: {s.attachmentCount}
                  {s.providerStatus
                    ? ` · Proveedor: ${s.providerStatus}`
                    : ''}
                </p>
                {s.error ? (
                  <p className="text-sm text-destructive">{s.error}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
