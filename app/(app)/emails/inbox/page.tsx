import Link from 'next/link';

import { EmailsShell } from '@/components/email/emails-shell';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';

export const dynamic = 'force-dynamic';

/**
 * Recibidos: sin bandeja ficticia.
 * La recepción IMAP/SiteGround requiere arquitectura aparte (ver docs).
 */
export default async function EmailsInboxPage() {
  await assertEmailsPageAccess();

  return (
    <EmailsShell title="Recibidos">
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
        <p className="text-sm font-medium">Bandeja de entrada no disponible todavía</p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          La recepción de correo corporativo se activará en una fase posterior.
          Mientras tanto puedes redactar, guardar borradores y consultar
          enviados.
        </p>
      </div>
    </EmailsShell>
  );
}
