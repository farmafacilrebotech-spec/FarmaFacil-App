'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  Copy,
  Pencil,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';

import {
  deleteEmailTemplateAction,
  duplicateEmailTemplateAction,
  updateEmailTemplateStatusAction,
  type EmailTemplateRow,
} from '@/app/(app)/emails/actions';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const ICON = 'h-4 w-4';

export function TemplatesPanel({
  templates,
}: {
  templates: EmailTemplateRow[];
}) {
  const router = useRouter();
  const [showArchived, setShowArchived] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const visible = templates.filter((t) =>
    showArchived ? true : t.status === 'active'
  );

  async function run(
    id: string,
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    okMsg?: string
  ) {
    setBusyId(id);
    const r = await fn();
    setBusyId(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    if (okMsg) toast.success(okMsg);
    router.refresh();
  }

  return (
    <TooltipProvider delayDuration={200}>
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
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/emails/compose?newTemplate=1">
              <Plus className="h-4 w-4" />
              Nueva plantilla
            </Link>
          </Button>
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay plantillas. Crea una con «Nueva plantilla».
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-soft">
            {visible.map((t) => {
              const busy = busyId === t.id;
              return (
                <li
                  key={t.id}
                  className="flex items-start gap-3 px-3 py-3 sm:px-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-snug">
                      {t.name}
                      {t.status !== 'active' ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          ({t.status === 'archived' ? 'archivada' : t.status})
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                      {t.subject || '(sin asunto)'}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    {t.status === 'active' ? (
                      <IconAction
                        href={`/emails/compose?templateId=${t.id}`}
                        label="Usar plantilla"
                        className="text-primary hover:bg-primary/10 hover:text-primary"
                      >
                        <Send className={ICON} />
                      </IconAction>
                    ) : null}
                    <IconAction
                      href={`/emails/compose?editTemplate=${t.id}`}
                      label="Editar plantilla"
                      className="text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className={ICON} />
                    </IconAction>
                    <IconAction
                      label="Duplicar"
                      disabled={busy}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() =>
                        void run(
                          t.id,
                          () => duplicateEmailTemplateAction(t.id),
                          'Plantilla duplicada.'
                        )
                      }
                    >
                      <Copy className={ICON} />
                    </IconAction>
                    <IconAction
                      label={t.status === 'active' ? 'Archivar' : 'Restaurar'}
                      disabled={busy}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() =>
                        void run(t.id, () =>
                          updateEmailTemplateStatusAction({
                            templateId: t.id,
                            status:
                              t.status === 'active' ? 'archived' : 'active',
                          })
                        )
                      }
                    >
                      {t.status === 'active' ? (
                        <Archive className={ICON} />
                      ) : (
                        <ArchiveRestore className={ICON} />
                      )}
                    </IconAction>
                    <IconAction
                      label="Eliminar"
                      disabled={busy}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        if (
                          !window.confirm(
                            '¿Eliminar esta plantilla? Los borradores vinculados no se borrarán.'
                          )
                        ) {
                          return;
                        }
                        void run(
                          t.id,
                          () => deleteEmailTemplateAction(t.id),
                          'Plantilla eliminada.'
                        );
                      }}
                    >
                      <Trash2 className={ICON} />
                    </IconAction>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </TooltipProvider>
  );
}

function IconAction({
  label,
  children,
  href,
  onClick,
  disabled,
  className,
}: {
  label: string;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const btnClass = cn(
    'inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors disabled:opacity-40',
    className
  );

  const control = href ? (
    <Link href={href} aria-label={label} className={btnClass}>
      {children}
    </Link>
  ) : (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={btnClass}
      onClick={onClick}
    >
      {children}
    </button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{control}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
