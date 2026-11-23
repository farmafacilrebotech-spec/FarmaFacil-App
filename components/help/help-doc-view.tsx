import { readFile } from 'fs/promises';
import path from 'path';
import Link from 'next/link';

import { PageHeader } from '@/components/shared/page-header';
import type { HelpDoc } from '@/lib/help/catalog';

/**
 * Vista de un documento del Centro de ayuda (fase A: markdown como texto).
 * Compartida por /ayuda/[docId] (plataforma) y /f/[pharmacyId]/ayuda/[docId] (tenant).
 * El gate de acceso se resuelve ANTES en cada page (backend).
 */
export async function HelpDocView({
  doc,
  backHref,
}: {
  doc: HelpDoc;
  backHref: string;
}) {
  let body = '';
  let loadError: string | null = null;

  if (doc.status === 'planned') {
    body =
      'Este manual está en preparación. Cuando exista contenido publicado se mostrará aquí.';
  } else {
    try {
      const abs = path.join(process.cwd(), doc.repoPath);
      // Solo rutas bajo docs/
      if (!doc.repoPath.startsWith('docs/')) {
        throw new Error('Ruta de documentación no permitida.');
      }
      body = await readFile(abs, 'utf8');
    } catch {
      loadError =
        'No se pudo cargar el documento. Comprueba que el archivo existe en el despliegue.';
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={doc.title} description={doc.summary} />
      <p className="text-xs text-muted-foreground">
        Actualizado: {doc.updatedAt}
        {doc.status === 'staging' ? ' · Pendiente de publicación' : null}
        {doc.internalTests ? ' · Documento interno de pruebas' : null}
      </p>
      <p>
        <Link
          href={backHref}
          className="text-sm text-primary underline-offset-2 hover:underline"
        >
          ← Volver al Centro de ayuda
        </Link>
      </p>
      {loadError ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {loadError}
        </p>
      ) : (
        <article className="overflow-x-auto rounded-xl border border-border bg-card p-5 shadow-soft">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
            {body}
          </pre>
        </article>
      )}
    </div>
  );
}
