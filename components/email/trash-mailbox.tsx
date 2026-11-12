'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  deleteEmailDraftAction,
  restoreEmailDraftAction,
  type EmailDraftRow,
} from '@/app/(app)/emails/actions';
import { Button } from '@/components/ui/button';

export function TrashMailbox({ drafts: initial }: { drafts: EmailDraftRow[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState(initial);

  React.useEffect(() => {
    setDrafts(initial);
  }, [initial]);

  if (drafts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">La papelera está vacía.</p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-soft">
      {drafts.map((d) => (
        <li
          key={d.id}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">
              {d.subject || '(Sin asunto)'}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {d.recipientEmail || 'sin destinatario'}
              {' · '}
              {new Date(d.updatedAt).toLocaleString('es-ES')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                void restoreEmailDraftAction(d.id).then((r) => {
                  if (!r.ok) toast.error(r.error);
                  else {
                    toast.success('Borrador restaurado.');
                    setDrafts((prev) => prev.filter((x) => x.id !== d.id));
                    router.refresh();
                  }
                })
              }
            >
              Restaurar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                if (!window.confirm('¿Eliminar definitivamente?')) return;
                void deleteEmailDraftAction(d.id).then((r) => {
                  if (!r.ok) toast.error(r.error);
                  else {
                    toast.success('Eliminado.');
                    setDrafts((prev) => prev.filter((x) => x.id !== d.id));
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
  );
}
