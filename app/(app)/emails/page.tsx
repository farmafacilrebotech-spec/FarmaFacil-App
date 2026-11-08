import Link from 'next/link';
import { FileText, Mail, PenLine } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';

export const dynamic = 'force-dynamic';

const TEMPLATES = [
  {
    href: '/emails/lanzadera',
    composeHref: '/emails/compose?template=lanzadera',
    id: 'ff-lanzadera-outreach-v3',
    title: 'Lanzadera',
    description: 'Informe de evolución e incorporación a Lanzadera.',
  },
  {
    href: '/emails/imprentas',
    composeHref: '/emails/compose?template=imprentas',
    id: 'ff-printing-quote-v1',
    title: 'Presupuesto imprentas',
    description: 'Solicitud de presupuesto de material corporativo.',
  },
  {
    href: '/emails/demo',
    composeHref: '/emails/compose?template=demo',
    id: 'ff-pharmacy-demo-v1',
    title: 'Invitación demostración',
    description: 'Invitar a farmacias a conocer y probar FarmaFácil.',
  },
  {
    href: '/emails/piloto',
    composeHref: '/emails/compose?template=piloto',
    id: 'ff-pharmacy-pilot-v1',
    title: 'Invitación piloto',
    description: 'Invitación al programa piloto de 30 días.',
  },
] as const;

/**
 * Hub SuperAdmin: plantillas (preview) + composer Fase A (sin envío).
 */
export default async function EmailsHubPage() {
  await assertEmailsPageAccess();

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Emails corporativos"
          description="Plantillas FarmaFácil, redacción y borradores. Envío bloqueado hasta autorización expresa."
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/emails/compose" className="gap-1.5">
              <PenLine className="h-4 w-4" />
              Nuevo email
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/emails/drafts" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Borradores
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        <p className="font-medium">Envío bloqueado en todas las plantillas</p>
        <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
          Remitente: Pilar Reyes · FarmaFácil &lt;pilar@farmafacil.solutions&gt; ·
          Reply-To: pilar@farmafacil.solutions. Persistencia de borradores
          requiere migración 075 (no aplicada automáticamente).
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <li key={t.href}>
            <div className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-soft">
              <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                <Mail className="h-4 w-4 text-primary" />
                {t.title}
              </span>
              <span className="mt-2 text-sm text-muted-foreground">
                {t.description}
              </span>
              <span className="mt-3 font-mono text-[11px] text-muted-foreground">
                {t.id}
              </span>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={t.href}>Vista previa</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={t.composeHref}>Usar en composer</Link>
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
