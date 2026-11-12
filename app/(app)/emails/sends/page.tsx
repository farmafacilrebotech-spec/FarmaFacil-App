import { listEmailSendsAction } from '@/app/(app)/emails/actions';
import { EmailsShell } from '@/components/email/emails-shell';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';
import { getCorporateSender } from '@/lib/email/senders';

export const dynamic = 'force-dynamic';

export default async function EmailSendsPage() {
  await assertEmailsPageAccess();
  const listed = await listEmailSendsAction();

  return (
    <EmailsShell
      title="Enviados"
      description="Outbox Resend/SMTP de prueba. Aceptado por el proveedor ≠ entregado."
    >
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
                </p>
                {s.error ? (
                  <p className="text-sm text-destructive">{s.error}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </EmailsShell>
  );
}
