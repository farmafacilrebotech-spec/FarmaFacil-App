import { listEmailSendsAction } from '@/app/(app)/emails/actions';
import { EmailsShell } from '@/components/email/emails-shell';
import { SendsMailbox } from '@/components/email/sends-mailbox';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';

export const dynamic = 'force-dynamic';

export default async function EmailSendsPage() {
  await assertEmailsPageAccess();
  const listed = await listEmailSendsAction();

  return (
    <EmailsShell
      title="Enviados"
      description="Historial outbox. Aceptado por Resend ≠ entregado."
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
        <SendsMailbox sends={listed.sends} />
      )}
    </EmailsShell>
  );
}
