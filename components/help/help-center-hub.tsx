import Link from 'next/link';
import {
  BookOpen,
  Construction,
  FlaskConical,
  HelpCircle,
  LifeBuoy,
  Rocket,
} from 'lucide-react';

import {
  HELP_HUB_STUB_SECTIONS,
  type HelpDoc,
  type HelpHubStubSection,
} from '@/lib/help/catalog';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<HelpDoc['status'], string> = {
  published: 'Publicado',
  staging: 'Pendiente de publicación',
  planned: 'En preparación',
};

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || 'soporte@farmafacil.solutions';

const STUB_ICON = {
  'primeros-pasos': Rocket,
  manuales: BookOpen,
  faq: HelpCircle,
  soporte: LifeBuoy,
} as const;

export function HelpCenterHub({
  docs,
  isSuperAdminTotal,
  basePath = '/ayuda',
  showStubs = true,
}: {
  docs: HelpDoc[];
  isSuperAdminTotal: boolean;
  /** Prefijo de rutas de documento: `/ayuda` (plataforma) o `/f/:id/ayuda` (tenant). */
  basePath?: string;
  /** Estructura del hub: primeros pasos / manuales / FAQ / soporte. */
  showStubs?: boolean;
}) {
  const manuals = docs.filter((d) => !d.internalTests && d.module !== 'gobernanza');
  const gov = docs.filter(
    (d) => d.internalTests || d.module === 'gobernanza' || d.status === 'staging'
  );

  return (
    <div className="space-y-8">
      {showStubs ? (
        <section
          aria-label="Estructura del Centro de ayuda"
          className="grid gap-3 sm:grid-cols-2"
          data-testid="help-hub-structure"
        >
          {HELP_HUB_STUB_SECTIONS.map((section) => (
            <HubStubCard
              key={section.id}
              section={section}
              manualsCount={manuals.length}
            />
          ))}
        </section>
      ) : null}

      <section className="space-y-3" id="manuales">
        <h2 className="text-lg font-semibold tracking-tight">Manuales y guías</h2>
        <p className="text-sm text-muted-foreground">
          Documentación viva alineada con la versión de la aplicación. Solo se
          muestran contenidos autorizados para tu perfil.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {manuals.map((doc) => (
            <HelpCard key={doc.id} doc={doc} basePath={basePath} />
          ))}
        </ul>
        {manuals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay manuales disponibles para este perfil todavía.
          </p>
        ) : null}
      </section>

      {isSuperAdminTotal ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <FlaskConical className="h-5 w-5 text-primary" />
            Gobernanza interna
          </h2>
          <p className="text-sm text-muted-foreground">
            Pruebas, historial e incidencias. No visible para farmacias ni
            clientes.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {gov.map((doc) => (
              <HelpCard key={doc.id} doc={doc} basePath={basePath} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-6">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Construction className="h-4 w-4" />
          Próximas mejoras del Centro de ayuda
        </p>
        <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
          <li>Buscador y navegación por capítulos</li>
          <li>Descarga PDF de manuales</li>
          <li>Ayuda contextual desde cada módulo</li>
        </ul>
      </section>
    </div>
  );
}

function HelpCard({ doc, basePath }: { doc: HelpDoc; basePath: string }) {
  return (
    <li
      className={cn(
        'rounded-xl border border-border bg-card p-4 shadow-soft',
        doc.status === 'planned' && 'opacity-80'
      )}
    >
      <div className="flex items-start gap-3">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{doc.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{doc.summary}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Actualizado: {doc.updatedAt} · {STATUS_LABEL[doc.status]}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Fuente:{' '}
            <code className="rounded bg-muted px-1 py-0.5">{doc.repoPath}</code>
          </p>
          <Link
            href={`${basePath}/${doc.id}`}
            className="mt-3 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Abrir
          </Link>
        </div>
      </div>
    </li>
  );
}

function HubStubCard({
  section,
  manualsCount,
}: {
  section: HelpHubStubSection;
  manualsCount: number;
}) {
  const Icon = STUB_ICON[section.id];
  return (
    <div
      data-testid={`help-hub-${section.id}`}
      className={cn(
        'rounded-xl border border-border bg-card p-4 shadow-soft',
        section.status === 'planned' && 'border-dashed bg-muted/20'
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{section.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {section.description}
          </p>
          {section.id === 'manuales' ? (
            <a
              href="#manuales"
              className="mt-2 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {manualsCount > 0
                ? `Ver ${manualsCount} ${manualsCount === 1 ? 'manual' : 'manuales'}`
                : 'Sin manuales para tu perfil todavía'}
            </a>
          ) : section.id === 'soporte' ? (
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-2 inline-block break-all text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          ) : (
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              En preparación
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
