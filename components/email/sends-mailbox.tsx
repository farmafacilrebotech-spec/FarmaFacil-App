'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp, Eye } from 'lucide-react';

import type { EmailSendRow } from '@/app/(app)/emails/actions';
import { MailboxIconAction } from '@/components/email/mailbox-icon-action';
import { Input } from '@/components/ui/input';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  CORPORATE_MANAGED_SENDERS,
  getCorporateSender,
} from '@/lib/email/senders';

const ICON = 'h-4 w-4';

const STATUS_OPTIONS = [
  { key: 'accepted_by_provider', label: 'Enviado a Resend' },
  { key: 'pending_send', label: 'Pendiente' },
  { key: 'delivered', label: 'Entregado' },
  { key: 'error', label: 'Error' },
  { key: 'bounced', label: 'Rebotado' },
  { key: 'blocked', label: 'Bloqueado' },
] as const;

export function SendsMailbox({ sends }: { sends: EmailSendRow[] }) {
  const [q, setQ] = React.useState('');
  const [account, setAccount] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [openId, setOpenId] = React.useState<string | null>(null);

  const filtered = sends.filter((s) => {
    if (account && s.fromKey !== account) return false;
    if (status && s.historyKind !== status) return false;
    if (!q.trim()) return true;
    const needle = q.trim().toLowerCase();
    return (
      s.subject.toLowerCase().includes(needle) ||
      s.recipientEmail.toLowerCase().includes(needle) ||
      s.fromAddress.toLowerCase().includes(needle)
    );
  });

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
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ningún envío coincide con el filtro.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-soft">
            {filtered.map((s) => {
              const sender = getCorporateSender(s.fromKey);
              const open = openId === s.id;
              return (
                <li key={s.id} className="px-3 py-3 sm:px-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">
                        {s.subject || '(Sin asunto)'}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        Para: {s.recipientEmail}
                        {' · '}
                        De: {sender.email}
                        {' · '}
                        {new Date(s.createdAt).toLocaleString('es-ES')}
                        {' · '}
                        {s.historyLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <MailboxIconAction
                        label={open ? 'Ocultar detalle' : 'Ver detalle'}
                        className="text-primary hover:bg-primary/10 hover:text-primary"
                        onClick={() => setOpenId(open ? null : s.id)}
                      >
                        {open ? (
                          <ChevronUp className={ICON} />
                        ) : (
                          <Eye className={ICON} />
                        )}
                      </MailboxIconAction>
                    </div>
                  </div>
                  {open ? (
                    <div className="mt-3 space-y-1 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                      <p>
                        <span className="text-muted-foreground">Tipo:</span>{' '}
                        {s.purpose === 'commercial'
                          ? 'Comercial'
                          : 'Operativa'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          Enviado por:
                        </span>{' '}
                        {s.createdByLabel || '—'}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Adjuntos:</span>{' '}
                        {s.attachmentCount}
                      </p>
                      <p>
                        <span className="text-muted-foreground">
                          Estado proveedor:
                        </span>{' '}
                        {s.providerStatus || '—'}
                      </p>
                      {s.error ? (
                        <p className="text-destructive">{s.error}</p>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </TooltipProvider>
  );
}
