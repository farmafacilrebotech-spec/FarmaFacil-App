'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Underline,
  ImageIcon,
} from 'lucide-react';

import {
  deleteDraftAttachmentAction,
  getCorporateEmailSendStatusAction,
  listCorporateSendersAction,
  listDraftAttachmentsAction,
  listEmailTemplatesAction,
  saveEmailAsTemplateAction,
  saveEmailDraftAction,
  sendCorporateEmailAction,
  trashEmailDraftAction,
  uploadDraftAttachmentAction,
  type EmailDraftAttachmentRow,
  type EmailTemplateRow,
} from '@/app/(app)/emails/actions';
import {
  extractComposerEditableHtml,
  htmlToPlainText,
  sanitizeEmailHtml,
  wrapComposerHtmlForSend,
} from '@/lib/email/html-sanitize';
import type { CorporateSender } from '@/lib/email/senders';
import {
  applySignaturePolicy,
  htmlHasEmbeddedSignature,
  stripManagedSignature,
} from '@/lib/email/signature';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ComposerDraft = {
  id: string | null;
  templateSlug: string;
  templateId: string | null;
  subject: string;
  htmlBody: string;
  textBody: string;
  recipientEmail: string;
  recipientName: string;
  ccEmails: string;
  bccEmails: string;
  fromKey: string;
  from: string;
  replyTo: string;
  /** Metadato interno (no se muestra en UI). */
  purpose: 'operational' | 'commercial';
};

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export function EmailComposer({ initial }: { initial: ComposerDraft }) {
  const router = useRouter();
  const editorRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [draft, setDraft] = React.useState<ComposerDraft>(initial);
  const [attachments, setAttachments] = React.useState<
    EmailDraftAttachmentRow[]
  >([]);
  const [templates, setTemplates] = React.useState<EmailTemplateRow[]>([]);
  const [senders, setSenders] = React.useState<CorporateSender[]>([]);
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [showCc, setShowCc] = React.useState(Boolean(initial.ccEmails?.trim()));
  const [showBcc, setShowBcc] = React.useState(
    Boolean(initial.bccEmails?.trim())
  );
  const [busyTemplate, setBusyTemplate] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [saveAsTplOpen, setSaveAsTplOpen] = React.useState(false);
  const [tplName, setTplName] = React.useState('');
  const [includeSignature, setIncludeSignature] = React.useState(
    !htmlHasEmbeddedSignature(initial.htmlBody)
  );
  const [sendStatus, setSendStatus] = React.useState<{
    sendEnabled: boolean;
    dryRun: boolean;
  } | null>(null);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : null;

  function renderEditorHtml(body: string, fromKey: string, withSig: boolean) {
    const editable = extractComposerEditableHtml(body);
    const applied = applySignaturePolicy({
      htmlBody: editable,
      textBody: '',
      fromKey,
      previewOrigin: origin,
      includeSignature: withSig,
    });
    return applied.html;
  }

  React.useEffect(() => {
    void getCorporateEmailSendStatusAction().then((r) => {
      if (r.ok) setSendStatus({ sendEnabled: r.sendEnabled, dryRun: r.dryRun });
    });
    void listCorporateSendersAction().then((r) => {
      if (r.ok) setSenders(r.senders);
    });
    void listEmailTemplatesAction().then((r) => {
      if (r.ok) setTemplates(r.templates);
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
    el.innerHTML =
      renderEditorHtml(draft.htmlBody, draft.fromKey, includeSignature) ||
      '<p><br/></p>';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.templateId, draft.id]);

  function syncEditorToDraft() {
    const raw = sanitizeEmailHtml(editorRef.current?.innerHTML ?? '');
    // Guardamos el cuerpo sin la firma gestionada (se re-aplica al render/envío)
    const bodyOnly = stripManagedSignature(raw);
    setDraft((d) => ({
      ...d,
      htmlBody: bodyOnly,
      textBody: htmlToPlainText(bodyOnly),
    }));
    setSaveState('dirty');
  }

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
  }

  function onFromKeyChange(nextKey: string) {
    if (nextKey === draft.fromKey) return;
    const hasEmbedded = htmlHasEmbeddedSignature(
      stripManagedSignature(editorRef.current?.innerHTML || draft.htmlBody)
    );
    if (hasEmbedded && includeSignature === false) {
      const ok = window.confirm(
        'Esta plantilla incluye una firma distinta. ¿Cambiar el remitente y mantener la firma de la plantilla?'
      );
      if (!ok) return;
      patch({ fromKey: nextKey });
      return;
    }
    if (includeSignature) {
      const ok = window.confirm(
        'Al cambiar el remitente se actualizará la firma. ¿Continuar?'
      );
      if (!ok) return;
    }
    patch({ fromKey: nextKey });
    // Re-render firma gestionada
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      const body = stripManagedSignature(el.innerHTML);
      el.innerHTML = renderEditorHtml(body, nextKey, includeSignature);
      syncEditorToDraft();
    });
  }

  function onIncludeSignatureToggle(next: boolean) {
    setIncludeSignature(next);
    const el = editorRef.current;
    if (!el) return;
    const body = stripManagedSignature(el.innerHTML);
    if (!next && htmlHasEmbeddedSignature(body)) {
      // Usuario desactiva: dejamos la firma embebida de plantilla
      el.innerHTML = body || '<p><br/></p>';
    } else {
      el.innerHTML = renderEditorHtml(body, draft.fromKey, next);
    }
    syncEditorToDraft();
  }

  function execCmd(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditorToDraft();
  }

  async function applyTemplate(templateId: string) {
    if (!templateId) {
      // Sin plantilla
      const blank = '<p><br/></p>';
      if (editorRef.current) {
        editorRef.current.innerHTML = renderEditorHtml(
          blank,
          draft.fromKey,
          true
        );
      }
      setIncludeSignature(true);
      patch({
        templateSlug: 'blank',
        templateId: null,
        subject: '',
        htmlBody: blank,
        textBody: '',
        purpose: 'operational',
      });
      return;
    }

    const dbTpl = templates.find((t) => t.id === templateId);
    if (!dbTpl) return;
    const confirmed =
      draft.subject || draft.htmlBody
        ? window.confirm(
            '¿Cargar la plantilla? Se sustituirán asunto y cuerpo. La plantilla original no se modificará.'
          )
        : true;
    if (!confirmed) return;

    setBusyTemplate(true);
    const editable = extractComposerEditableHtml(dbTpl.htmlBody);
    const hasSig = htmlHasEmbeddedSignature(editable);
    const useManagedSig =
      dbTpl.includeSignature !== false && !hasSig ? true : !hasSig;
    setIncludeSignature(useManagedSig);
    if (editorRef.current) {
      editorRef.current.innerHTML = renderEditorHtml(
        editable,
        draft.fromKey,
        useManagedSig
      );
    }
    patch({
      templateSlug: dbTpl.systemKey || 'custom',
      templateId: dbTpl.id,
      subject: dbTpl.subject,
      htmlBody: stripManagedSignature(editable),
      textBody: dbTpl.textBody || htmlToPlainText(editable),
      purpose: dbTpl.purpose,
    });
    setBusyTemplate(false);
  }

  async function onSave() {
    setSaveState('saving');
    syncEditorToDraft();
    const body = stripManagedSignature(
      sanitizeEmailHtml(editorRef.current?.innerHTML || draft.htmlBody)
    );
    const result = await saveEmailDraftAction({
      id: draft.id,
      templateSlug: draft.templateSlug || 'blank',
      templateId: draft.templateId,
      subject: draft.subject,
      htmlBody: body,
      textBody: htmlToPlainText(body),
      recipientEmail: draft.recipientEmail,
      recipientName: draft.recipientName || null,
      ccEmails: draft.ccEmails,
      bccEmails: draft.bccEmails,
      purpose: draft.purpose,
      fromKey: draft.fromKey,
    });
    if (!result.ok) {
      setSaveState('error');
      toast.error(result.error);
      return;
    }
    setDraft((d) => ({
      ...d,
      id: result.draft.id,
      htmlBody: result.draft.htmlBody,
      textBody: result.draft.textBody,
      purpose: result.draft.purpose,
      fromKey: result.draft.fromKey,
      ccEmails: result.draft.ccEmails.join(', '),
      bccEmails: result.draft.bccEmails.join(', '),
      templateId: result.draft.templateId,
    }));
    setSaveState('saved');
    toast.success('Borrador guardado.');
    if (!draft.id) router.replace(`/emails/compose?draft=${result.draft.id}`);
    router.refresh();
  }

  async function onDiscard() {
    if (draft.id) {
      if (!window.confirm('¿Enviar este borrador a la papelera?')) return;
      const result = await trashEmailDraftAction(draft.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Borrador movido a la papelera.');
    }
    router.push('/emails/drafts');
    router.refresh();
  }

  async function onSaveAsTemplate() {
    if (!tplName.trim()) {
      toast.error('Indica un nombre para la plantilla.');
      return;
    }
    const body = stripManagedSignature(
      sanitizeEmailHtml(editorRef.current?.innerHTML || draft.htmlBody)
    );
    const result = await saveEmailAsTemplateAction({
      name: tplName.trim(),
      subject: draft.subject,
      htmlBody: body,
      textBody: htmlToPlainText(body),
      purpose: draft.purpose,
      category: 'personalizada',
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setSaveAsTplOpen(false);
    setTplName('');
    toast.success('Plantilla guardada.');
    void listEmailTemplatesAction().then((r) => {
      if (r.ok) setTemplates(r.templates);
    });
  }

  async function onFilesSelected(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    let currentDraftId = draft.id;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set('file', file);
      if (currentDraftId) fd.set('draftId', currentDraftId);
      fd.set('templateSlug', draft.templateSlug || 'blank');
      fd.set('subject', draft.subject);
      fd.set(
        'htmlBody',
        stripManagedSignature(editorRef.current?.innerHTML || draft.htmlBody)
      );
      fd.set('textBody', draft.textBody);
      fd.set('recipientEmail', draft.recipientEmail);
      fd.set('recipientName', draft.recipientName);
      fd.set('ccEmails', draft.ccEmails);
      fd.set('bccEmails', draft.bccEmails);
      fd.set('purpose', draft.purpose);
      fd.set('fromKey', draft.fromKey);
      const result = await uploadDraftAttachmentAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        break;
      }
      currentDraftId = result.draftId;
      setDraft((d) => ({ ...d, id: result.draftId }));
      setAttachments((prev) => [
        ...prev.filter((a) => a.id !== result.attachment.id),
        result.attachment,
      ]);
      if (!draft.id) router.replace(`/emails/compose?draft=${result.draftId}`);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onConfirmSend() {
    setSending(true);
    const body = stripManagedSignature(
      sanitizeEmailHtml(editorRef.current?.innerHTML || draft.htmlBody)
    );
    const forSend = applySignaturePolicy({
      htmlBody: body,
      textBody: htmlToPlainText(body),
      fromKey: draft.fromKey,
      previewOrigin: origin,
      includeSignature,
    });
    const result = await sendCorporateEmailAction({
      draftId: draft.id,
      explicitConfirm: true,
      purpose: draft.purpose,
      fromKey: draft.fromKey,
      recipientEmail: draft.recipientEmail,
      recipientName: draft.recipientName || null,
      ccEmails: draft.ccEmails,
      bccEmails: draft.bccEmails,
      subject: draft.subject,
      htmlBody: wrapComposerHtmlForSend(forSend.html),
      textBody: forSend.text,
      templateSlug: draft.templateSlug,
      previewOrigin: origin,
      includeSignature: false, // ya aplicada en forSend
    });
    setSending(false);
    setConfirmOpen(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.dryRun ? 'Envío de prueba registrado.' : 'Correo enviado.'
    );
    router.push('/emails/sends');
    router.refresh();
  }

  const selectedSender =
    senders.find((s) => s.key === draft.fromKey) || senders[0];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="border-b border-border px-4 py-3">
          <Label htmlFor="tpl" className="text-xs text-muted-foreground">
            Plantilla
          </Label>
          <select
            id="tpl"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            disabled={busyTemplate}
            value={draft.templateId || ''}
            onChange={(e) => void applyTemplate(e.target.value)}
          >
            <option value="">Sin plantilla</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="divide-y divide-border">
          <FieldRow label="De">
            <select
              className="h-9 w-full bg-transparent text-sm outline-none"
              value={draft.fromKey}
              onChange={(e) => onFromKeyChange(e.target.value)}
            >
              {(senders.length
                ? senders
                : [
                    {
                      key: 'pilar',
                      displayName: 'Pilar Reyes',
                      email: 'pilar@farmafacil.solutions',
                    } as CorporateSender,
                  ]
              ).map((s) => (
                <option key={s.key} value={s.key}>
                  {s.displayName} — {s.email}
                </option>
              ))}
            </select>
          </FieldRow>

          <FieldRow
            label="Para"
            trailing={
              <div className="flex gap-2 text-xs">
                {!showCc ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCc(true)}
                  >
                    CC
                  </button>
                ) : null}
                {!showBcc ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setShowBcc(true)}
                  >
                    CCO
                  </button>
                ) : null}
              </div>
            }
          >
            <Input
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              type="email"
              placeholder="destinatario@ejemplo.com"
              value={draft.recipientEmail}
              onChange={(e) => patch({ recipientEmail: e.target.value })}
              autoComplete="off"
            />
          </FieldRow>

          {showCc ? (
            <FieldRow label="CC">
              <Input
                className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                placeholder="cc@… (máx. 2)"
                value={draft.ccEmails}
                onChange={(e) => patch({ ccEmails: e.target.value })}
                autoComplete="off"
              />
            </FieldRow>
          ) : null}

          {showBcc ? (
            <FieldRow label="CCO">
              <Input
                className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                placeholder="cco@… (máx. 2)"
                value={draft.bccEmails}
                onChange={(e) => patch({ bccEmails: e.target.value })}
                autoComplete="off"
              />
            </FieldRow>
          ) : null}

          <FieldRow label="Asunto">
            <Input
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              value={draft.subject}
              onChange={(e) => patch({ subject: e.target.value })}
            />
          </FieldRow>
        </div>

        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 px-2 py-1">
          <ToolBtn onClick={() => execCmd('bold')} title="Negrita">
            <Bold className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => execCmd('italic')} title="Cursiva">
            <Italic className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => execCmd('underline')} title="Subrayado">
            <Underline className="h-3.5 w-3.5" />
          </ToolBtn>
          <span className="mx-1 w-px self-stretch bg-border" />
          <ToolBtn onClick={() => execCmd('justifyLeft')} title="Izquierda">
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => execCmd('justifyCenter')} title="Centro">
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn onClick={() => execCmd('justifyRight')} title="Derecha">
            <AlignRight className="h-3.5 w-3.5" />
          </ToolBtn>
          <span className="mx-1 w-px self-stretch bg-border" />
          <ToolBtn
            onClick={() => execCmd('insertUnorderedList')}
            title="Lista"
          >
            <List className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            onClick={() => execCmd('insertOrderedList')}
            title="Numerada"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            onClick={() => {
              const url = window.prompt('URL del enlace');
              if (url) execCmd('createLink', url);
            }}
            title="Enlace"
          >
            <Link2 className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn
            onClick={() => {
              const url = window.prompt('URL de imagen (https)');
              if (url) execCmd('insertImage', url);
            }}
            title="Imagen"
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </ToolBtn>
          <label className="ml-auto flex items-center gap-2 px-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={includeSignature}
              onChange={(e) => onIncludeSignatureToggle(e.target.checked)}
            />
            Incluir firma
          </label>
        </div>

        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-label="Cuerpo del mensaje"
          className="min-h-[320px] px-4 py-3 text-sm leading-relaxed outline-none"
          onInput={syncEditorToDraft}
          suppressContentEditableWarning
        />

        <div className="space-y-2 border-t border-border px-4 py-3">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,image/*"
            onChange={(e) => void onFilesSelected(e.target.files)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="mr-1.5 h-3.5 w-3.5" />
              {uploading ? 'Subiendo…' : 'Adjuntar'}
            </Button>
            {attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs"
              >
                {a.fileName}
                <button
                  type="button"
                  className="text-destructive"
                  onClick={() =>
                    void deleteDraftAttachmentAction(a.id).then((r) => {
                      if (r.ok) {
                        setAttachments((p) => p.filter((x) => x.id !== a.id));
                      } else toast.error(r.error);
                    })
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-4 py-3">
          <Button
            type="button"
            disabled={!sendStatus?.sendEnabled || sending}
            onClick={() => setConfirmOpen(true)}
          >
            Enviar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void onSave()}
            disabled={saveState === 'saving'}
          >
            Guardar borrador
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setSaveAsTplOpen(true)}
          >
            Guardar como plantilla
          </Button>
          <Button type="button" variant="ghost" onClick={() => void onDiscard()}>
            Descartar
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {saveState === 'saving'
              ? 'Guardando…'
              : saveState === 'saved'
                ? 'Guardado'
                : saveState === 'dirty'
                  ? 'Sin guardar'
                  : null}
          </span>
        </div>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-lg font-semibold">Confirmar envío</h2>
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
              {draft.ccEmails ? (
                <div>
                  <dt className="text-muted-foreground">CC</dt>
                  <dd className="font-medium">{draft.ccEmails}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Asunto</dt>
                <dd className="font-medium">{draft.subject || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Adjuntos</dt>
                <dd className="font-medium">{attachments.length}</dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2">
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

      {saveAsTplOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Guardar como plantilla</h2>
            <Input
              placeholder="Nombre de la plantilla"
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSaveAsTplOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={() => void onSaveAsTemplate()}>
                Guardar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FieldRow({
  label,
  children,
  trailing,
}: {
  label: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-1.5">
      <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
