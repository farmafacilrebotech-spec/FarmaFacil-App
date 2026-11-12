'use client';

import * as React from 'react';
import Link from 'next/link';

import type { EmailDraftRow } from '@/app/(app)/emails/actions';
import { DraftsDeleteButton } from '@/components/email/drafts-delete-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CORPORATE_MANAGED_SENDERS } from '@/lib/email/senders';

export function DraftsMailbox({
  drafts,
  templateTitle,
}: {
  drafts: EmailDraftRow[];
  templateTitle: (slug: string) => string;
}) {
  const [q, setQ] = React.useState('');
  const [account, setAccount] = React.useState('');

  const filtered = drafts.filter((d) => {
    if (account && d.fromKey !== account) return false;
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      d.subject.toLowerCase().includes(needle) ||
      d.recipientEmail.toLowerCase().includes(needle) ||
      d.ccEmails.some((e) => e.includes(needle))
    );
  });

  return (
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
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {d.subject || '(Sin asunto)'}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {templateTitle(d.templateSlug)}
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
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/emails/compose?draft=${d.id}`}>Abrir</Link>
                </Button>
                <DraftsDeleteButton draftId={d.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
