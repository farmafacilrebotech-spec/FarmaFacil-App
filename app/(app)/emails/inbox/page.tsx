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
    <EmailsShell
      title="Recibidos"
      description="Bandeja de entrada de cuentas corporativas"
    >
      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-10 text-center">
        <p className="text-sm font-medium">Recepción aún no conectada</p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Las cuentas viven en SiteGround (IMAP/webmail). Integrar Recibidos
          requiere un worker fuera de Vercel serverless, secretos en vault y
          sincronización segura. No se muestra una bandeja simulada.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Detalle técnico:{' '}
          <Link
            href="/emails"
            className="underline underline-offset-2 hover:text-foreground"
          >
            ver resumen del módulo
          </Link>{' '}
          y documento{' '}
          <code className="rounded bg-muted px-1 py-0.5">
            docs/emails/SITEGROUND_IMAP_AUDIT.md
          </code>
          .
        </p>
      </div>
    </EmailsShell>
  );
}
