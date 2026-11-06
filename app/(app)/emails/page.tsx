import Link from 'next/link';
import { Mail } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';

export const dynamic = 'force-dynamic';

const TEMPLATES = [
  {
    href: '/emails/lanzadera',
    id: 'ff-lanzadera-outreach-v3',
    title: 'Lanzadera',
    description: 'Informe de evolución e incorporación a Lanzadera.',
  },
  {
    href: '/emails/imprentas',
    id: 'ff-printing-quote-v1',
    title: 'Presupuesto imprentas',
    description: 'Solicitud de presupuesto de material corporativo.',
  },
  {
    href: '/emails/demo',
    id: 'ff-pharmacy-demo-v1',
    title: 'Invitación demostración',
    description: 'Invitar a farmacias a conocer y probar FarmaFácil.',
  },
  {
    href: '/emails/piloto',
    id: 'ff-pharmacy-pilot-v1',
    title: 'Invitación piloto',
    description: 'Invitación al programa piloto de 30 días.',
  },
] as const;

/**
 * Hub SuperAdmin de plantillas corporativas.
 * Solo vista previa. Envío deshabilitado.
 */
export default function EmailsHubPage() {
  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6">
      <PageHeader
        title="Emails corporativos"
        description="Plantillas FarmaFácil para vista previa. Sin envío hasta autorización expresa."
      />

      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        <p className="font-medium">Envío bloqueado en todas las plantillas</p>
        <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
          Remitente: Pilar Reyes · FarmaFácil &lt;pilar@farmafacil.solutions&gt; ·
          Reply-To: pilar@farmafacil.solutions
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-soft transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
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
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
