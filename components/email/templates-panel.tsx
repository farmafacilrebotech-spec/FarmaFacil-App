'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  deleteEmailTemplateAction,
  duplicateEmailTemplateAction,
  updateEmailTemplateAction,
  updateEmailTemplateStatusAction,
  type EmailTemplateRow,
} from '@/app/(app)/emails/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function TemplatesPanel({
  templates,
}: {
  templates: EmailTemplateRow[];
}) {
  const router = useRouter();
  const [showArchived, setShowArchived] = React.useState(false);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState('');

  const visible = templates.filter((t) =>
    showArchived ? true : t.status === 'active'
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Mostrar archivadas
        </label>
        <Button asChild size="sm">
          <Link href="/emails/compose">Nueva desde correo</Link>
        </Button>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay plantillas. Crea una desde el compositor con «Guardar como
          plantilla».
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-soft">
          {visible.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                {renamingId === t.id ? (
                  <div className="flex flex-wrap gap-2">
                    <Input
                      className="h-8 max-w-xs"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        void updateEmailTemplateAction({
                          templateId: t.id,
                          name: renameValue,
                        }).then((r) => {
                          if (!r.ok) toast.error(r.error);
                          else {
                            toast.success('Nombre actualizado.');
                            setRenamingId(null);
                            router.refresh();
                          }
                        })
                      }
                    >
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setRenamingId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="truncate font-medium">
                      {t.name}
                      {t.status !== 'active' ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          ({t.status === 'archived' ? 'archivada' : t.status})
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {t.subject || '(sin asunto)'}
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {t.status === 'active' ? (
                  <Button asChild size="sm">
                    <Link href={`/emails/compose?templateId=${t.id}`}>
                      Usar
                    </Link>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRenamingId(t.id);
                    setRenameValue(t.name);
                  }}
                >
                  Renombrar
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
                      status: t.status === 'active' ? 'archived' : 'active',
                    }).then((r) => {
                      if (!r.ok) toast.error(r.error);
                      else router.refresh();
                    })
                  }
                >
                  {t.status === 'active' ? 'Archivar' : 'Restaurar'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (
                      !window.confirm(
                        '¿Eliminar esta plantilla? Los borradores vinculados no se borrarán.'
                      )
                    ) {
                      return;
                    }
                    void deleteEmailTemplateAction(t.id).then((r) => {
                      if (!r.ok) toast.error(r.error);
                      else {
                        toast.success('Plantilla eliminada.');
                        router.refresh();
                      }
                    });
                  }}
                >
                  Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
