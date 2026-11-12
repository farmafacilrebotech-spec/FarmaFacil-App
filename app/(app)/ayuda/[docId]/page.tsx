import { readFile } from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { canAccessHelpDoc } from '@/lib/help/access';

export const dynamic = 'force-dynamic';

export default async function HelpDocPage({
  params,
}: {
  params: { docId: string };
}) {
  const access = await canAccessHelpDoc(params.docId);
  if (!access.ok) {
    if (access.reason === 'unauthenticated') {
      redirect(`/login?next=/ayuda/${params.docId}`);
    }
    if (access.reason === 'not_found') notFound();
    redirect('/access-denied');
  }

  const { doc } = access;
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
          href="/ayuda"
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
