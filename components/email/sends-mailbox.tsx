'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, Trash2, X } from 'lucide-react';

import {
  getEmailSendDetailAction,
  getSendAttachmentDownloadUrlAction,
  trashEmailSendAction,
  type EmailSendRow,
} from '@/app/(app)/emails/actions';
import { MailboxIconAction } from '@/components/email/mailbox-icon-action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  CORPORATE_MANAGED_SENDERS,
  getCorporateSender,
} from '@/lib/email/senders';

const ICON = 'h-4 w-4';

const STATUS_OPTIONS = [
  { key: 'pending_send', label: 'Pendiente' },
  { key: 'accepted_by_provider', label: 'Aceptado por el proveedor' },
  { key: 'delivered', label: 'Entregado' },
  { key: 'error', label: 'Error de envío' },
  { key: 'bounced', label: 'Rebotado' },
  { key: 'blocked', label: 'Bloqueado' },
] as const;

export function SendsMailbox({ sends }: { sends: EmailSendRow[] }) {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [account, setAccount] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [detail, setDetail] = React.useState<EmailSendRow | null>(null);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

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

  async function onOpen(sendId: string) {
    setLoadingId(sendId);
    const result = await getEmailSendDetailAction(sendId);
    setLoadingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setDetail(result.send);
  }

  async function onTrash(sendId: string) {
    if (
      !window.confirm(
        '¿Mover este correo enviado a la papelera? Podrás restaurarlo después. La auditoría se conserva.'
      )
    ) {
      return;
    }
    setBusyId(sendId);
    const result = await trashEmailSendAction(sendId);
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Envío movido a la papelera.');
    if (detail?.id === sendId) setDetail(null);
    router.refresh();
  }

  async function onDownloadAttachment(sendId: string, attachmentId: string) {
    const result = await getSendAttachmentDownloadUrlAction(
      sendId,
      attachmentId
    );
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.fileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
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
              return (
                <li
                  key={s.id}
                  className="flex items-start gap-3 px-3 py-3 sm:px-4"
                >
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
                      label="Abrir correo completo"
                      disabled={loadingId === s.id}
                      className="text-primary hover:bg-primary/10 hover:text-primary"
                      onClick={() => void onOpen(s.id)}
                    >
                      <Eye className={ICON} />
                    </MailboxIconAction>
                    <MailboxIconAction
                      label="Mover a la papelera"
                      disabled={busyId === s.id}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => void onTrash(s.id)}
                    >
                      <Trash2 className={ICON} />
                    </MailboxIconAction>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {detail ? (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Detalle del correo enviado"
          >
            <div className="relative my-6 w-full max-w-3xl rounded-xl border border-border bg-card p-4 shadow-lg sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-snug">
                    {detail.subject || '(Sin asunto)'}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Solo lectura · snapshot del envío
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Cerrar"
                  onClick={() => setDetail(null)}
                >
                  <X className={ICON} />
                </Button>
              </div>

              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Remitente</dt>
                  <dd className="font-medium">{detail.fromAddress}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Para</dt>
                  <dd className="font-medium">{detail.recipientEmail}</dd>
                </div>
                {detail.ccEmails.length > 0 ? (
                  <div>
                    <dt className="text-muted-foreground">CC</dt>
                    <dd className="font-medium">
                      {detail.ccEmails.join(', ')}
                    </dd>
                  </div>
                ) : null}
                {detail.bccEmails.length > 0 ? (
                  <div>
                    <dt className="text-muted-foreground">CCO</dt>
                    <dd className="font-medium">
                      {detail.bccEmails.join(', ')}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-muted-foreground">Fecha y hora</dt>
                  <dd className="font-medium">
                    {new Date(detail.sentAt || detail.createdAt).toLocaleString(
                      'es-ES'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tipo</dt>
                  <dd className="font-medium">{detail.purposeLabel}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Enviado por</dt>
                  <dd className="font-medium">
                    {detail.createdByLabel || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Estado de entrega</dt>
                  <dd className="font-medium">
                    {detail.historyLabel}
                    {detail.historyKind === 'accepted_by_provider' ? (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        No implica entrega en el buzón (sin webhooks de
                        entrega).
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Detalle proveedor</dt>
                  <dd className="font-medium">
                    {detail.providerStatus
                      ? detail.providerStatusLabel
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Firma enviada</dt>
                  <dd className="font-medium">
                    {detail.signatureIncluded
                      ? detail.signatureLabel
                        ? `Sí — ${detail.signatureLabel}`
                        : 'Sí'
                      : 'No'}
                  </dd>
                </div>
              </dl>

              <div className="mt-4">
                <p className="mb-2 text-sm font-medium">Cuerpo enviado</p>
                {detail.finalHtmlAvailable && detail.htmlBody ? (
                  <div
                    className="max-h-[50vh] overflow-auto rounded-lg border border-border bg-background p-3 text-sm"
                    dangerouslySetInnerHTML={{ __html: detail.htmlBody }}
                  />
                ) : (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                    El contenido completo de este correo no está disponible. No
                    se reconstruye a partir de plantillas o firmas actuales.
                  </p>
                )}
              </div>

              {(detail.attachments?.length ?? 0) > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium">Adjuntos</p>
                  <ul className="space-y-1 text-sm">
                    {detail.attachments!.map((a) => (
                      <li key={a.id} className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-primary underline-offset-2 hover:underline"
                          onClick={() =>
                            void onDownloadAttachment(detail.id, a.id)
                          }
                        >
                          {a.fileName}
                        </button>
                        <span className="text-muted-foreground">
                          ({a.byteSizeLabel})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : detail.attachmentCount > 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  {detail.attachmentCount} adjunto(s) registrados.
                </p>
              ) : null}

              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDetail(null)}
                >
                  Cerrar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busyId === detail.id}
                  onClick={() => void onTrash(detail.id)}
                >
                  Mover a papelera
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
