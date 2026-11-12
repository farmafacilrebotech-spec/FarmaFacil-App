'use client';

import * as React from 'react';
import Link from 'next/link';
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
  deleteEmailDraftAction,
  getComposeSeedAction,
  getCorporateEmailSendStatusAction,
  listCorporateSendersAction,
  listDraftAttachmentsAction,
  listEmailTemplatesAction,
  saveEmailAsTemplateAction,
  saveEmailDraftAction,
  sendCorporateEmailAction,
  uploadDraftAttachmentAction,
  type EmailDraftAttachmentRow,
  type EmailTemplateRow,
} from '@/app/(app)/emails/actions';
import {
  defaultPurposeForTemplate,
  resolveEffectivePurpose,
  type EmailLegalBasis,
  type EmailPurpose,
} from '@/lib/email/corporate-send-policy';
import { htmlToPlainText, sanitizeEmailHtml } from '@/lib/email/html-sanitize';
import type { CorporateSender } from '@/lib/email/senders';
import { appendSignatureIfNeeded } from '@/lib/email/signature';
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
  purpose: EmailPurpose;
  legalBasis: EmailLegalBasis | '';
  commercialAuthAck: boolean;
  oppositionChecked: boolean;
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
  const [showCc, setShowCc] = React.useState(
    Boolean(initial.ccEmails?.trim())
  );
  const [showBcc, setShowBcc] = React.useState(
    Boolean(initial.bccEmails?.trim())
  );
  const [busyTemplate, setBusyTemplate] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [saveAsTplOpen, setSaveAsTplOpen] = React.useState(false);
  const [tplName, setTplName] = React.useState('');
  const [sendStatus, setSendStatus] = React.useState<{
    sendEnabled: boolean;
    dryRun: boolean;
  } | null>(null);

  const effectivePurpose = resolveEffectivePurpose(
    draft.templateSlug === 'custom' ? 'blank' : draft.templateSlug,
    draft.purpose
  );
  const commercialForced =
    draft.purpose === 'commercial' ||
    (draft.templateSlug !== 'custom' &&
      defaultPurposeForTemplate(draft.templateSlug) === 'commercial');

  React.useEffect(() => {
    void getCorporateEmailSendStatusAction().then((r) => {
      if (r.ok) setSendStatus({ sendEnabled: r.sendEnabled, dryRun: r.dryRun });
    });
    void listCorporateSendersAction().then((r) => {
      if (r.ok) setSenders(r.senders);
    });
    void listEmailTemplatesAction().then((r) => {
      if (r.ok) setTemplates(r.templates.filter((t) => t.status === 'active'));
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
    el.innerHTML = draft.htmlBody || '<p><br/></p>';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.templateSlug, draft.templateId, draft.id]);

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

  function onEditorInput() {
    const html = sanitizeEmailHtml(editorRef.current?.innerHTML ?? '');
    setDraft((d) => ({
      ...d,
      htmlBody: html,
      textBody: htmlToPlainText(html),
    }));
    setSaveState('dirty');
  }

  function execCmd(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    onEditorInput();
  }

  async function applyTemplate(templateIdOrSlug: string) {
    if (!templateIdOrSlug) return;
    const confirmed =
      draft.subject || draft.htmlBody
        ? window.confirm(
            '¿Cargar la plantilla? Se sustituirán asunto y cuerpo. La plantilla original no se modificará.'
          )
        : true;
    if (!confirmed) return;

    setBusyTemplate(true);
    const dbTpl = templates.find((t) => t.id === templateIdOrSlug);
    if (dbTpl) {
      const html = sanitizeEmailHtml(dbTpl.htmlBody);
      if (editorRef.current) editorRef.current.innerHTML = html || '<p><br/></p>';
      patch({
        templateSlug: dbTpl.systemKey || 'custom',
        templateId: dbTpl.id,
        subject: dbTpl.subject,
        htmlBody: html,
        textBody: dbTpl.textBody || htmlToPlainText(html),
        purpose: dbTpl.purpose,
      });
      setBusyTemplate(false);
      return;
    }

    const result = await getComposeSeedAction(
      templateIdOrSlug,
      window.location.origin
    );
    setBusyTemplate(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const html = sanitizeEmailHtml(result.seed.htmlBody);
    if (editorRef.current) editorRef.current.innerHTML = html || '<p><br/></p>';
    patch({
      templateSlug: result.seed.templateSlug,
      templateId: null,
      subject: result.seed.subject,
      htmlBody: html,
      textBody: result.seed.textBody,
      purpose: defaultPurposeForTemplate(result.seed.templateSlug),
    });
  }

  async function onSave() {
    setSaveState('saving');
    const html = sanitizeEmailHtml(
      editorRef.current?.innerHTML || draft.htmlBody
    );
    const result = await saveEmailDraftAction({
      id: draft.id,
      templateSlug: draft.templateSlug,
      templateId: draft.templateId,
      subject: draft.subject,
      htmlBody: html,
      textBody: htmlToPlainText(html),
      recipientEmail: draft.recipientEmail,
      recipientName: draft.recipientName || null,
      ccEmails: draft.ccEmails,
      bccEmails: draft.bccEmails,
      purpose: draft.purpose,
      legalBasis: draft.legalBasis || null,
      commercialAuthAck: draft.commercialAuthAck,
      oppositionChecked: draft.oppositionChecked,
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
      if (!window.confirm('¿Descartar y eliminar este borrador?')) return;
      const result = await deleteEmailDraftAction(draft.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
    }
    router.push('/emails/drafts');
    router.refresh();
  }

  async function onSaveAsTemplate() {
    if (!tplName.trim()) {
      toast.error('Indica un nombre para la plantilla.');
      return;
    }
    const html = sanitizeEmailHtml(
      editorRef.current?.innerHTML || draft.htmlBody
    );
    const result = await saveEmailAsTemplateAction({
      name: tplName.trim(),
      subject: draft.subject,
      htmlBody: html,
      textBody: htmlToPlainText(html),
      purpose: effectivePurpose,
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
      if (r.ok) setTemplates(r.templates.filter((t) => t.status === 'active'));
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
      fd.set('templateSlug', draft.templateSlug);
      fd.set('subject', draft.subject);
      fd.set('htmlBody', draft.htmlBody);
      fd.set('textBody', draft.textBody);
      fd.set('recipientEmail', draft.recipientEmail);
      fd.set('recipientName', draft.recipientName);
      fd.set('ccEmails', draft.ccEmails);
      fd.set('bccEmails', draft.bccEmails);
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
    const html = sanitizeEmailHtml(
      editorRef.current?.innerHTML || draft.htmlBody
    );
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
      ccEmails: draft.ccEmails,
      bccEmails: draft.bccEmails,
      subject: draft.subject,
      htmlBody: html,
      textBody: htmlToPlainText(html),
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
        ? `Prueba registrada: ${result.historyLabel}`
        : `Confirmado: ${result.historyLabel}`
    );
    router.push('/emails/sends');
    router.refresh();
  }

  const selectedSender =
    senders.find((s) => s.key === draft.fromKey) || senders[0];

  const previewSig = appendSignatureIfNeeded({
    htmlBody: '',
    textBody: '',
    fromKey: draft.fromKey,
    previewOrigin:
      typeof window !== 'undefined' ? window.location.origin : null,
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link
          href="/emails/drafts"
          className="text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Borradores
        </Link>
        <span className="text-xs text-muted-foreground">
          {saveState === 'saving'
            ? 'Guardando…'
            : saveState === 'saved'
              ? 'Guardado'
              : saveState === 'dirty'
                ? 'Sin guardar'
                : draft.id
                  ? 'Borrador'
                  : 'Nuevo'}
        </span>
      </div>

      {/* Caja única estilo Gmail */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="border-b border-border px-4 py-3">
          <Label htmlFor="tpl" className="text-xs text-muted-foreground">
            Plantilla (opcional)
          </Label>
          <select
            id="tpl"
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            disabled={busyTemplate}
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              if (v) void applyTemplate(v);
              e.target.value = '';
            }}
          >
            <option value="">Sin plantilla / elegir…</option>
            <optgroup label="Sistema">
              <option value="blank">En blanco</option>
              <option value="lanzadera">Lanzadera</option>
              <option value="imprentas">Presupuesto imprentas</option>
              <option value="demo">Invitación demostración</option>
              <option value="piloto">Invitación piloto</option>
            </optgroup>
            {templates.length > 0 ? (
              <optgroup label="Guardadas">
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>

        <div className="divide-y divide-border">
          <FieldRow label="De">
            <select
              className="h-9 w-full bg-transparent text-sm outline-none"
              value={draft.fromKey}
              onChange={(e) => patch({ fromKey: e.target.value })}
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
                placeholder="cc1@…, cc2@… (máx. 2)"
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
                placeholder="cco1@…, cco2@… (máx. 2)"
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

        {/* Toolbar + editor visual */}
        <div className="flex flex-wrap gap-0.5 border-b border-border bg-muted/30 px-2 py-1">
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
              const url = window.prompt(
                'URL de imagen (https). Las remotas de seguimiento se bloquean al leer.'
              );
              if (url) execCmd('insertImage', url);
            }}
            title="Imagen"
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </ToolBtn>
          <select
            className="ml-1 h-7 rounded border border-transparent bg-transparent px-1 text-xs"
            defaultValue="3"
            onChange={(e) => execCmd('fontSize', e.target.value)}
            title="Tamaño"
          >
            <option value="2">Pequeño</option>
            <option value="3">Normal</option>
            <option value="4">Grande</option>
            <option value="5">Muy grande</option>
          </select>
        </div>

        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-label="Cuerpo del mensaje"
          className="min-h-[280px] px-4 py-3 text-sm leading-relaxed outline-none focus-visible:ring-0"
          onInput={onEditorInput}
          suppressContentEditableWarning
        />

        {/* Firma corporativa (vista) */}
        <div
          className="border-t border-border bg-muted/20 px-4 py-3 text-sm"
          dangerouslySetInnerHTML={{ __html: previewSig.html }}
        />

        {/* Adjuntos */}
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
            <span className="text-xs text-muted-foreground">
              PDF, Word, Excel, imágenes · máx. 5 · 5 MB
            </span>
          </div>
          {attachments.length > 0 ? (
            <ul className="space-y-1">
              {attachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">
                    {a.fileName}{' '}
                    <span className="text-xs text-muted-foreground">
                      ({a.byteSizeLabel})
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-xs text-destructive"
                    onClick={() =>
                      void deleteDraftAttachmentAction(a.id).then((r) => {
                        if (r.ok) {
                          setAttachments((p) => p.filter((x) => x.id !== a.id));
                        } else toast.error(r.error);
                      })
                    }
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Cumplimiento comercial */}
        <div className="space-y-2 border-t border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="purpose" className="text-xs">
              Tipo
            </Label>
            <select
              id="purpose"
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              value={commercialForced ? 'commercial' : draft.purpose}
              disabled={
                draft.templateSlug !== 'custom' &&
                defaultPurposeForTemplate(draft.templateSlug) === 'commercial'
              }
              onChange={(e) =>
                patch({ purpose: e.target.value as EmailPurpose })
              }
            >
              <option value="operational">Operativa</option>
              <option value="commercial">Comercial</option>
            </select>
          </div>
          {effectivePurpose === 'commercial' || commercialForced ? (
            <div className="space-y-2 rounded-lg bg-amber-500/5 p-3 text-sm">
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={draft.legalBasis}
                onChange={(e) =>
                  patch({
                    legalBasis: e.target.value as EmailLegalBasis | '',
                  })
                }
              >
                <option value="">Base jurídica…</option>
                <option value="consent">Consentimiento</option>
                <option value="legitimate_interest_documented">
                  Interés legítimo documentado
                </option>
                <option value="contractual">Relación contractual</option>
              </select>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={draft.commercialAuthAck}
                  onChange={(e) =>
                    patch({ commercialAuthAck: e.target.checked })
                  }
                />
                <span>Autorización/base legal válida para este envío.</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={draft.oppositionChecked}
                  onChange={(e) =>
                    patch({ oppositionChecked: e.target.checked })
                  }
                />
                <span>
                  He comprobado oposición/bajas (Para, CC y CCO).
                </span>
              </label>
            </div>
          ) : null}
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-4 py-3">
          <Button
            type="button"
            disabled={!sendStatus?.sendEnabled || sending}
            onClick={() => setConfirmOpen(true)}
          >
            {!sendStatus?.sendEnabled
              ? 'Enviar (desactivado)'
              : 'Revisar y enviar'}
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
        </div>
      </div>

      {sendStatus && !sendStatus.sendEnabled ? (
        <p className="text-xs text-muted-foreground">
          El envío está desactivado en servidor. Puedes redactar, adjuntar y
          guardar borradores.
        </p>
      ) : sendStatus?.dryRun ? (
        <p className="text-xs text-muted-foreground">
          Modo de prueba: se registra el envío sin entregar correo real.
        </p>
      ) : null}

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-lg font-semibold">Confirmar envío</h2>
            <p className="text-sm text-muted-foreground">
              Envío individual. CC/CCO cuentan como destinatarios y están sujetos
              a las mismas restricciones.
              {sendStatus?.dryRun
                ? ' Se registrará en modo de prueba.'
                : ' Se enviará de verdad.'}
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
              {draft.ccEmails ? (
                <div>
                  <dt className="text-muted-foreground">CC</dt>
                  <dd className="font-medium">{draft.ccEmails}</dd>
                </div>
              ) : null}
              {draft.bccEmails ? (
                <div>
                  <dt className="text-muted-foreground">CCO</dt>
                  <dd className="font-medium">{draft.bccEmails}</dd>
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
