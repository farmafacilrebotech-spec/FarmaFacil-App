import Link from 'next/link';
import { BookOpen, FlaskConical, Construction } from 'lucide-react';

import type { HelpDoc } from '@/lib/help/catalog';
import { cn } from '@/lib/utils';

const STATUS_LABEL: Record<HelpDoc['status'], string> = {
  published: 'Publicado',
  staging: 'Pendiente de publicación',
  planned: 'En preparación',
};

export function HelpCenterHub({
  docs,
  isSuperAdminTotal,
}: {
  docs: HelpDoc[];
  isSuperAdminTotal: boolean;
}) {
  const manuals = docs.filter((d) => !d.internalTests && d.module !== 'gobernanza');
  const gov = docs.filter(
    (d) => d.internalTests || d.module === 'gobernanza' || d.status === 'staging'
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Manuales y guías</h2>
        <p className="text-sm text-muted-foreground">
          Documentación viva alineada con la versión de la aplicación. Solo se
          muestran contenidos autorizados para tu perfil.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {manuals.map((doc) => (
            <HelpCard key={doc.id} doc={doc} />
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
              <HelpCard key={doc.id} doc={doc} />
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

function HelpCard({ doc }: { doc: HelpDoc }) {
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
            href={`/ayuda/${doc.id}`}
            className="mt-3 inline-block text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Abrir
          </Link>
        </div>
      </div>
    </li>
  );
}
