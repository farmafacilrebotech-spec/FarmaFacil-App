'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Trash2 } from 'lucide-react';

import { trashEmailDraftAction, type EmailDraftRow } from '@/app/(app)/emails/actions';
import { MailboxIconAction } from '@/components/email/mailbox-icon-action';
import { Input } from '@/components/ui/input';
import {
  TooltipProvider,
} from '@/components/ui/tooltip';
import { CORPORATE_MANAGED_SENDERS } from '@/lib/email/senders';

const ICON = 'h-4 w-4';

function resolveTemplateTitle(
  draft: EmailDraftRow,
  templateTitles: Record<string, string>
): string {
  const key = draft.templateId || draft.templateSlug || 'blank';
  return (
    templateTitles[key] ||
    (draft.templateId ? templateTitles[draft.templateId] : undefined) ||
    templateTitles[draft.templateSlug] ||
    draft.templateSlug
  );
}

export function DraftsMailbox({
  drafts,
  templateTitles,
}: {
  drafts: EmailDraftRow[];
  /** Mapa serializable id|slug → nombre (resuelto en servidor). */
  templateTitles: Record<string, string>;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [account, setAccount] = React.useState('');
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const filtered = drafts.filter((d) => {
    if (account && d.fromKey !== account) return false;
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    const title = resolveTemplateTitle(d, templateTitles).toLowerCase();
    return (
      d.subject.toLowerCase().includes(needle) ||
      d.recipientEmail.toLowerCase().includes(needle) ||
      title.includes(needle) ||
      d.ccEmails.some((e) => e.includes(needle))
    );
  });

  async function onTrash(draftId: string) {
    if (
      !window.confirm(
        '¿Enviar este borrador a la papelera? Podrás restaurarlo después.'
      )
    ) {
      return;
    }
    setBusyId(draftId);
    const result = await trashEmailDraftAction(draftId);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Borrador movido a la papelera.');
    router.refresh();
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-9 max-w-xs"
            placeholder="Buscar asunto o destinatario…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          >
            <option value="">Todas las cuentas</option>
            {CORPORATE_MANAGED_SENDERS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.email}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ningún borrador coincide con el filtro.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-soft">
            {filtered.map((d) => (
              <li
                key={d.id}
                className="flex items-start gap-3 px-3 py-3 sm:px-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug">
                    {d.subject || '(Sin asunto)'}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {resolveTemplateTitle(d, templateTitles)}
                    {d.recipientEmail
                      ? ` · ${d.recipientEmail}`
                      : ' · sin destinatario'}
                    {d.ccEmails.length ? ` · CC ${d.ccEmails.length}` : ''}
                    {' · '}
                    {d.fromKey}
                    {' · '}
                    {new Date(d.updatedAt).toLocaleString('es-ES')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <MailboxIconAction
                    href={`/emails/compose?draft=${d.id}`}
                    label="Abrir borrador"
                    className="text-primary hover:bg-primary/10 hover:text-primary"
                  >
                    <Pencil className={ICON} />
                  </MailboxIconAction>
                  <MailboxIconAction
                    label="Enviar a la papelera"
                    disabled={busyId === d.id}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => void onTrash(d.id)}
                  >
                    <Trash2 className={ICON} />
                  </MailboxIconAction>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TooltipProvider>
  );
}
