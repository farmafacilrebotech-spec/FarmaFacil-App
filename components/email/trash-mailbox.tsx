'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArchiveRestore, Trash2 } from 'lucide-react';

import {
  deleteEmailDraftAction,
  restoreEmailDraftAction,
  type EmailDraftRow,
} from '@/app/(app)/emails/actions';
import { MailboxIconAction } from '@/components/email/mailbox-icon-action';
import { TooltipProvider } from '@/components/ui/tooltip';

const ICON = 'h-4 w-4';

export function TrashMailbox({ drafts: initial }: { drafts: EmailDraftRow[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState(initial);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDrafts(initial);
  }, [initial]);

  if (drafts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">La papelera está vacía.</p>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-soft">
        {drafts.map((d) => (
          <li
            key={d.id}
            className="flex items-start gap-3 px-3 py-3 sm:px-4"
          >
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-medium leading-snug">
                {d.subject || '(Sin asunto)'}
              </p>
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                {d.recipientEmail || 'sin destinatario'}
                {' · '}
                {new Date(d.updatedAt).toLocaleString('es-ES')}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <MailboxIconAction
                label="Restaurar borrador"
                disabled={busyId === d.id}
                className="text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => {
                  setBusyId(d.id);
                  void restoreEmailDraftAction(d.id).then((r) => {
                    setBusyId(null);
                    if (!r.ok) toast.error(r.error);
                    else {
                      toast.success('Borrador restaurado.');
                      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
                      router.refresh();
                    }
                  });
                }}
              >
                <ArchiveRestore className={ICON} />
              </MailboxIconAction>
              <MailboxIconAction
                label="Eliminar definitivamente"
                disabled={busyId === d.id}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (!window.confirm('¿Eliminar definitivamente este borrador?')) {
                    return;
                  }
                  setBusyId(d.id);
                  void deleteEmailDraftAction(d.id).then((r) => {
                    setBusyId(null);
                    if (!r.ok) toast.error(r.error);
                    else {
                      toast.success('Eliminado definitivamente.');
                      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
                      router.refresh();
                    }
                  });
                }}
              >
                <Trash2 className={ICON} />
              </MailboxIconAction>
            </div>
          </li>
        ))}
      </ul>
    </TooltipProvider>
  );
}
