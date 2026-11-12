import Link from 'next/link';
import { FileText, Inbox, LayoutTemplate, PenLine, Send } from 'lucide-react';
import { redirect } from 'next/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';

export const dynamic = 'force-dynamic';

/**
 * Hub Emails → bandeja Recibidos (estructura Gmail-like).
 * ?hub=1 mantiene el resumen.
 */
export default async function EmailsHubPage({
  searchParams,
}: {
  searchParams?: { hub?: string };
}) {
  await assertEmailsPageAccess();

  if (searchParams?.hub !== '1') {
    redirect('/emails/inbox');
  }

  const cards = [
    {
      href: '/emails/inbox',
      title: 'Recibidos',
      description: 'IMAP SiteGround (pendiente de arquitectura).',
      icon: Inbox,
    },
    {
      href: '/emails/sends',
      title: 'Enviados',
      description: 'Historial outbox / Resend.',
      icon: Send,
    },
    {
      href: '/emails/drafts',
      title: 'Borradores',
      description: 'Con adjuntos y cuentas corporativas.',
      icon: FileText,
    },
    {
      href: '/emails/templates',
      title: 'Plantillas',
      description: 'Sistema + editables guardadas.',
      icon: LayoutTemplate,
    },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Emails corporativos"
          description="Gestor 1:1 · compositor compacto · sin campañas masivas."
        />
        <Button asChild>
          <Link href="/emails/compose" className="gap-1.5">
            <PenLine className="h-4 w-4" />
            Nuevo email
          </Link>
        </Button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <li key={c.href}>
              <Link
                href={c.href}
                className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary/40"
              >
                <span className="flex items-center gap-2 text-base font-semibold">
                  <Icon className="h-4 w-4 text-primary" />
                  {c.title}
                </span>
                <span className="mt-2 text-sm text-muted-foreground">
                  {c.description}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
