'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  duplicateEmailTemplateAction,
  updateEmailTemplateStatusAction,
  type EmailTemplateRow,
} from '@/app/(app)/emails/actions';
import { Button } from '@/components/ui/button';

export function TemplatesPanel({
  templates,
  systemCards,
}: {
  templates: EmailTemplateRow[];
  systemCards: Array<{
    slug: string;
    title: string;
    description: string;
    previewHref: string;
  }>;
}) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Corporativas (sistema)
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {systemCards.map((t) => (
            <li
              key={t.slug}
              className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-soft"
            >
              <p className="font-medium">{t.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={t.previewHref}>Vista previa</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href={`/emails/compose?template=${t.slug}`}>
                    Usar para redactar
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Plantillas guardadas
          </h2>
          <Button asChild size="sm">
            <Link href="/emails/compose">Crear desde nuevo email</Link>
          </Button>
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay plantillas personalizadas. Redacta un correo y usa
            «Guardar como plantilla».
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-soft">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {t.category}
                    {' · '}
                    {t.purpose === 'commercial' ? 'Comercial' : 'Operativa'}
                    {' · '}
                    {t.status}
                    {' · '}
                    {t.subject || '(sin asunto)'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link href={`/emails/compose?templateId=${t.id}`}>
                      Usar
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void duplicateEmailTemplateAction(t.id).then((r) => {
                        if (!r.ok) toast.error(r.error);
                        else {
                          toast.success('Plantilla duplicada.');
                          router.refresh();
                        }
                      })
                    }
                  >
                    Duplicar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void updateEmailTemplateStatusAction({
                        templateId: t.id,
                        status:
                          t.status === 'active' ? 'archived' : 'active',
                      }).then((r) => {
                        if (!r.ok) toast.error(r.error);
                        else router.refresh();
                      })
                    }
                  >
                    {t.status === 'active' ? 'Archivar' : 'Reactivar'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
