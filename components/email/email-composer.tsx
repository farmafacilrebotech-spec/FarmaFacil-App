'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  deleteDraftAttachmentAction,
  deleteEmailDraftAction,
  getComposeSeedAction,
  getCorporateEmailSendStatusAction,
  listCorporateSendersAction,
  listDraftAttachmentsAction,
  saveEmailDraftAction,
  sendCorporateEmailAction,
  uploadDraftAttachmentAction,
  type EmailDraftAttachmentRow,
} from '@/app/(app)/emails/actions';
import {
  EMAIL_TEMPLATE_OPTIONS,
  type EmailTemplateSlug,
} from '@/lib/email/compose-catalog';
import {
  defaultPurposeForTemplate,
  resolveEffectivePurpose,
  type EmailLegalBasis,
  type EmailPurpose,
} from '@/lib/email/corporate-send-policy';
import type { CorporateSender } from '@/lib/email/senders';
import { appendSignatureIfNeeded } from '@/lib/email/signature';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ComposerDraft = {
  id: string | null;
  templateSlug: EmailTemplateSlug;
  subject: string;
  htmlBody: string;
  textBody: string;
  recipientEmail: string;
  recipientName: string;
  fromKey: string;
  from: string;
  replyTo: string;
  purpose: EmailPurpose;
  legalBasis: EmailLegalBasis | '';
  commercialAuthAck: boolean;
  oppositionChecked: boolean;
};

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function EmailComposer({
  initial,
}: {
  initial: ComposerDraft;
}) {
  const router = useRouter();
  const editorRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [draft, setDraft] = React.useState<ComposerDraft>(initial);
  const [attachments, setAttachments] = React.useState<
    EmailDraftAttachmentRow[]
  >([]);
  const [senders, setSenders] = React.useState<CorporateSender[]>([]);
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [previewTab, setPreviewTab] = React.useState<'html' | 'text'>('html');
  const [busyTemplate, setBusyTemplate] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [sendStatus, setSendStatus] = React.useState<{
    sendEnabled: boolean;
    dryRun: boolean;
  } | null>(null);

  const effectivePurpose = resolveEffectivePurpose(
    draft.templateSlug,
    draft.purpose
  );
  const commercialForced =
    defaultPurposeForTemplate(draft.templateSlug) === 'commercial';

  React.useEffect(() => {
    void getCorporateEmailSendStatusAction().then((r) => {
      if (r.ok) {
        setSendStatus({
          sendEnabled: r.sendEnabled,
          dryRun: r.dryRun,
        });
      }
    });
    void listCorporateSendersAction().then((r) => {
      if (r.ok) setSenders(r.senders);
    });
  }, []);

  React.useEffect(() => {
    if (!draft.id) {
      setAttachments([]);
      return;
    }
    void listDraftAttachmentsAction(draft.id).then((r) => {
      if (r.ok) setAttachments(r.attachments);
    });
  }, [draft.id]);

  React.useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== draft.htmlBody) {
      el.innerHTML = draft.htmlBody || '<p><br/></p>';
    }
    // solo al montar / cambiar plantilla vía patch externo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.templateSlug, draft.id]);

  function patch(partial: Partial<ComposerDraft>) {
    setDraft((d) => {
      const next = { ...d, ...partial };
      if (partial.fromKey) {
        const s = senders.find((x) => x.key === partial.fromKey);
        if (s) {
          next.from = s.fromHeader;
          next.replyTo = s.replyTo;
        }
      }
      return next;
    });
    setSaveState('dirty');
    setSaveError(null);
  }

  function onEditorInput() {
    const html = editorRef.current?.innerHTML ?? '';
    const text = htmlToPlainText(html);
    setDraft((d) => ({ ...d, htmlBody: html, textBody: text }));
    setSaveState('dirty');
    setSaveError(null);
  }

  function execCmd(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    onEditorInput();
  }

  async function onTemplateChange(slug: EmailTemplateSlug) {
    if (slug === draft.templateSlug) return;
    const confirmed =
      draft.subject || draft.htmlBody
        ? window.confirm(
            '¿Cargar la plantilla seleccionada? Se sustituirán asunto y cuerpo actuales.'
          )
        : true;
    if (!confirmed) return;

    setBusyTemplate(true);
    const result = await getComposeSeedAction(slug, window.location.origin);
    setBusyTemplate(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const html = result.seed.htmlBody;
    if (editorRef.current) editorRef.current.innerHTML = html || '<p><br/></p>';
    patch({
      templateSlug: result.seed.templateSlug,
      subject: result.seed.subject,
      htmlBody: html,
      textBody: result.seed.textBody,
      purpose: defaultPurposeForTemplate(slug),
    });
  }

  async function onSave() {
    setSaveState('saving');
    setSaveError(null);
    const result = await saveEmailDraftAction({
      id: draft.id,
      templateSlug: draft.templateSlug,
      subject: draft.subject,
      htmlBody: draft.htmlBody,
      textBody: draft.textBody || htmlToPlainText(draft.htmlBody),
      recipientEmail: draft.recipientEmail,
      recipientName: draft.recipientName || null,
      purpose: draft.purpose,
      legalBasis: draft.legalBasis || null,
      commercialAuthAck: draft.commercialAuthAck,
      oppositionChecked: draft.oppositionChecked,
      fromKey: draft.fromKey,
    });
    if (!result.ok) {
      setSaveState('error');
      setSaveError(result.error);
      toast.error(result.error);
      return;
    }
    setDraft((d) => ({
      ...d,
      id: result.draft.id,
      subject: result.draft.subject,
      htmlBody: result.draft.htmlBody,
      textBody: result.draft.textBody,
      recipientEmail: result.draft.recipientEmail,
      recipientName: result.draft.recipientName ?? '',
      templateSlug: result.draft.templateSlug,
      purpose: result.draft.purpose,
      legalBasis: result.draft.legalBasis ?? '',
      commercialAuthAck: result.draft.commercialAuthAck,
      oppositionChecked: result.draft.oppositionChecked,
      fromKey: result.draft.fromKey,
    }));
    setSaveState('saved');
    toast.success('Borrador guardado.');
    if (!draft.id) {
      router.replace(`/emails/compose?draft=${result.draft.id}`);
    }
    router.refresh();
  }

  async function onDelete() {
    if (!draft.id) return;
    if (!window.confirm('¿Eliminar este borrador?')) return;
    setDeleting(true);
    const result = await deleteEmailDraftAction(draft.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Borrador eliminado.');
    router.push('/emails/drafts');
    router.refresh();
  }

  async function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    let currentDraftId = draft.id;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set('file', file);
      if (currentDraftId) fd.set('draftId', currentDraftId);
      fd.set('templateSlug', draft.templateSlug);
      fd.set('subject', draft.subject);
      fd.set('htmlBody', draft.htmlBody);
      fd.set('textBody', draft.textBody);
      fd.set('recipientEmail', draft.recipientEmail);
      fd.set('recipientName', draft.recipientName);
      fd.set('purpose', draft.purpose);
      fd.set('legalBasis', draft.legalBasis || '');
      fd.set('commercialAuthAck', draft.commercialAuthAck ? '1' : '0');
      fd.set('oppositionChecked', draft.oppositionChecked ? '1' : '0');
      fd.set('fromKey', draft.fromKey);
      const result = await uploadDraftAttachmentAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        break;
      }
      currentDraftId = result.draftId;
      setDraft((d) => ({ ...d, id: result.draftId }));
      setAttachments((prev) => {
        const without = prev.filter((a) => a.id !== result.attachment.id);
        return [...without, result.attachment];
      });
      if (!draft.id) {
        router.replace(`/emails/compose?draft=${result.draftId}`);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    router.refresh();
  }

  async function onRemoveAttachment(id: string) {
    const result = await deleteDraftAttachmentAction(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    toast.success('Adjunto eliminado.');
  }

  async function onConfirmSend() {
    setSending(true);
    const result = await sendCorporateEmailAction({
      draftId: draft.id,
      explicitConfirm: true,
      purpose: draft.purpose,
      legalBasis: draft.legalBasis || null,
      commercialAuthAck: draft.commercialAuthAck,
      oppositionChecked: draft.oppositionChecked,
      fromKey: draft.fromKey,
      recipientEmail: draft.recipientEmail,
      recipientName: draft.recipientName || null,
      subject: draft.subject,
      htmlBody: draft.htmlBody,
      textBody: draft.textBody || htmlToPlainText(draft.htmlBody),
      templateSlug: draft.templateSlug,
      previewOrigin: window.location.origin,
    });
    setSending(false);
    setConfirmOpen(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.dryRun
        ? `Prueba registrada: ${result.historyLabel}. No se envió correo real.`
        : `Confirmado: ${result.historyLabel}.`
    );
    router.push('/emails/sends');
    router.refresh();
  }

  const previewHtml = appendSignatureIfNeeded({
    htmlBody: draft.htmlBody,
    textBody: draft.textBody,
    fromKey: draft.fromKey,
    previewOrigin:
      typeof window !== 'undefined' ? window.location.origin : null,
  }).html;

  const previewText = appendSignatureIfNeeded({
    htmlBody: draft.htmlBody,
    textBody: draft.textBody || htmlToPlainText(draft.htmlBody),
    fromKey: draft.fromKey,
  }).text;

  const selectedSender =
    senders.find((s) => s.key === draft.fromKey) || senders[0];

  const statusLabel =
    saveState === 'saving'
      ? 'Guardando…'
      : saveState === 'saved'
        ? 'Guardado'
        : saveState === 'dirty'
          ? 'Cambios sin guardar'
          : saveState === 'error'
            ? 'Error al guardar'
            : draft.id
              ? 'Borrador cargado'
              : 'Nuevo borrador';

  const sendBanner = !sendStatus
    ? null
    : !sendStatus.sendEnabled
      ? 'El envío está desactivado. Puedes guardar borradores y adjuntos.'
      : sendStatus.dryRun
        ? 'Modo de prueba: se registra el envío sin entregar correo real.'
        : 'Envío real habilitado. Revisa y confirma antes de enviar.';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
        <div>
          <p className="font-medium">Email corporativo individual</p>
          {sendBanner ? (
            <p className="mt-1 text-muted-foreground">{sendBanner}</p>
          ) : null}
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {statusLabel}
        </p>
      </div>

      {saveError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {saveError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="template">Plantilla</Label>
            <select
              id="template"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={draft.templateSlug}
              disabled={busyTemplate}
              onChange={(e) =>
                void onTemplateChange(e.target.value as EmailTemplateSlug)
              }
            >
              {EMAIL_TEMPLATE_OPTIONS.map((opt) => (
                <option key={opt.slug} value={opt.slug}>
                  {opt.title}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fromKey">Remitente</Label>
            <select
              id="fromKey"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={draft.fromKey}
              onChange={(e) => patch({ fromKey: e.target.value })}
            >
              {(senders.length > 0
                ? senders
                : [
                    {
                      key: draft.fromKey || 'pilar',
                      displayName: draft.from || 'pilar@farmafacil.solutions',
                      email: draft.replyTo,
                    } as CorporateSender,
                  ]
              ).map((s) => (
                <option key={s.key} value={s.key}>
                  {s.displayName} ({s.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Solo remitentes autorizados del dominio corporativo. Reply-To:{' '}
              {selectedSender?.replyTo || draft.replyTo}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Tipo de comunicación</Label>
            <select
              id="purpose"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={effectivePurpose}
              disabled={commercialForced}
              onChange={(e) =>
                patch({ purpose: e.target.value as EmailPurpose })
              }
            >
              <option value="operational">Operativa (servicio)</option>
              <option value="commercial">Comercial (marketing/prospección)</option>
            </select>
            {commercialForced ? (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                Esta plantilla es comercial: no se pueden eludir los controles
                de autorización.
              </p>
            ) : null}
          </div>

          {effectivePurpose === 'commercial' ? (
            <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="space-y-2">
                <Label htmlFor="legal">Base jurídica</Label>
                <select
                  id="legal"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.legalBasis}
                  onChange={(e) =>
                    patch({
                      legalBasis: e.target.value as EmailLegalBasis | '',
                    })
                  }
                >
                  <option value="">Seleccionar…</option>
                  <option value="consent">Consentimiento</option>
                  <option value="legitimate_interest_documented">
                    Interés legítimo documentado
                  </option>
                  <option value="contractual">Relación contractual</option>
                </select>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={draft.commercialAuthAck}
                  onChange={(e) =>
                    patch({ commercialAuthAck: e.target.checked })
                  }
                />
                <span>
                  Confirmo autorización/base legal válida para este envío
                  comercial individual.
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={draft.oppositionChecked}
                  onChange={(e) =>
                    patch({ oppositionChecked: e.target.checked })
                  }
                />
                <span>
                  He comprobado oposición/bajas para este destinatario.
                </span>
              </label>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="to">Destinatario</Label>
            <Input
              id="to"
              type="email"
              placeholder="nombre@ejemplo.com"
              value={draft.recipientEmail}
              onChange={(e) => patch({ recipientEmail: e.target.value })}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="toName">Nombre destinatario (opcional)</Label>
            <Input
              id="toName"
              value={draft.recipientName}
              onChange={(e) => patch({ recipientName: e.target.value })}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Asunto</Label>
            <Input
              id="subject"
              value={draft.subject}
              onChange={(e) => patch({ subject: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Mensaje</Label>
            <div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-input bg-muted/40 p-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => execCmd('bold')}
              >
                Negrita
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => execCmd('italic')}
              >
                Cursiva
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => execCmd('underline')}
              >
                Subrayado
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => execCmd('insertUnorderedList')}
              >
                Lista
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  const url = window.prompt('URL del enlace');
                  if (url) execCmd('createLink', url);
                }}
              >
                Enlace
              </Button>
            </div>
            <div
              ref={editorRef}
              contentEditable
              role="textbox"
              aria-label="Cuerpo del email"
              className="min-h-[220px] rounded-b-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onInput={onEditorInput}
              suppressContentEditableWarning
            />
            <p className="text-xs text-muted-foreground">
              La firma corporativa con logo circular se añade automáticamente en
              la vista previa y al enviar.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Adjuntos</Label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => void onFilesSelected(e.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? 'Subiendo…' : 'Adjuntar archivos'}
              </Button>
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                PDF, Word, Excel, PNG o JPG · máx. 5 archivos · 5 MB c/u.
                Almacenamiento privado. Los adjuntos se conservan con el
                borrador.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        .{a.extension || '—'} · {a.byteSizeLabel}
                        {a.sourceKind !== 'upload'
                          ? ` · ${a.sourceKind}`
                          : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void onRemoveAttachment(a.id)}
                    >
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              onClick={() => void onSave()}
              disabled={saveState === 'saving'}
            >
              {saveState === 'saving' ? 'Guardando…' : 'Guardar borrador'}
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={!sendStatus?.sendEnabled || sending}
              onClick={() => setConfirmOpen(true)}
            >
              {!sendStatus?.sendEnabled
                ? 'Enviar (desactivado)'
                : sendStatus.dryRun
                  ? 'Revisar y enviar (prueba)…'
                  : 'Revisar y enviar…'}
            </Button>
            {draft.id ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void onDelete()}
                disabled={deleting}
              >
                Eliminar
              </Button>
            ) : null}
            <Button type="button" variant="ghost" asChild>
              <Link href="/emails/drafts">Borradores</Link>
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href="/emails/sends">Historial</Link>
            </Button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Vista previa</p>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={previewTab === 'html' ? 'default' : 'outline'}
                onClick={() => setPreviewTab('html')}
              >
                HTML
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewTab === 'text' ? 'default' : 'outline'}
                onClick={() => setPreviewTab('text')}
              >
                Texto
              </Button>
            </div>
          </div>
          <dl className="grid gap-1 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">De</dt>
              <dd className="font-medium">
                {selectedSender?.fromHeader || draft.from || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Para</dt>
              <dd className="font-medium">
                {draft.recipientEmail || '—'}
                {draft.recipientName ? ` (${draft.recipientName})` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Asunto</dt>
              <dd className="font-medium">{draft.subject || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Adjuntos</dt>
              <dd className="font-medium">
                {attachments.length === 0
                  ? 'Ninguno'
                  : attachments.map((a) => a.fileName).join(', ')}
              </dd>
            </div>
          </dl>
          {previewTab === 'html' ? (
            <iframe
              title="Vista previa HTML"
              className="h-[520px] w-full rounded-lg border border-border bg-white"
              sandbox=""
              srcDoc={`<div style="font-family:Arial,Helvetica,sans-serif;padding:16px;color:#111827;">${previewHtml}</div>`}
            />
          ) : (
            <pre className="h-[520px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-xs">
              {previewText || '—'}
            </pre>
          )}
        </div>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-lg font-semibold">Confirmar envío individual</h2>
            <p className="text-sm text-muted-foreground">
              Revisa la vista previa. Este flujo es 1:1 (sin envíos masivos).
              {sendStatus?.dryRun
                ? ' Se registrará en modo de prueba, sin correo real.'
                : ' Se enviará de verdad al destinatario indicado.'}
            </p>
            <dl className="space-y-1 text-sm">
              <div>
                <dt className="text-muted-foreground">De</dt>
                <dd className="font-medium">
                  {selectedSender?.fromHeader || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Para</dt>
                <dd className="font-medium">{draft.recipientEmail || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Asunto</dt>
                <dd className="font-medium">{draft.subject || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tipo</dt>
                <dd className="font-medium">
                  {effectivePurpose === 'commercial'
                    ? 'Comercial'
                    : 'Operativa'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Adjuntos</dt>
                <dd className="font-medium">{attachments.length}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={sending}
                onClick={() => setConfirmOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={sending}
                onClick={() => void onConfirmSend()}
              >
                {sending ? 'Enviando…' : 'Confirmar envío'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
