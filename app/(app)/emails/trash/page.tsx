import { EmailsShell } from '@/components/email/emails-shell';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';

export const dynamic = 'force-dynamic';

export default async function EmailsTrashPage() {
  await assertEmailsPageAccess();

  return (
    <EmailsShell
      title="Papelera"
      description="Disponible cuando exista sincronización IMAP con SiteGround"
    >
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
        <p className="text-sm font-medium">Papelera no disponible</p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Depende de carpetas IMAP del proveedor. Hasta entonces, los borradores
          se eliminan de forma permanente desde Borradores y los envíos
          fallidos/bloqueados permanecen en Enviados con su estado.
        </p>
      </div>
    </EmailsShell>
  );
}
