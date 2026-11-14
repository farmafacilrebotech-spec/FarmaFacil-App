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
  listPharmacyPortfolioRecipientsAction,
  saveEmailAsTemplateAction,
  saveEmailDraftAction,
  sendCorporateEmailAction,
  trashEmailDraftAction,
  updateEmailTemplateAction,
  uploadDraftAttachmentAction,
  type EmailDraftAttachmentRow,
  type EmailTemplateRow,
  type PharmacyPortfolioRecipientRow,
} from '@/app/(app)/emails/actions';
import {
  extractComposerEditableHtml,
  htmlToPlainText,
  sanitizeEmailHtml,
  wrapComposerHtmlForSend,
} from '@/lib/email/html-sanitize';
import {
  buildComposerShellHtml,
  composeTemplateSendBody,
  extractComposerNoteHtml,
  extractNoteAgainstLockedTemplate,
} from '@/lib/email/composer-template-lock';
import { COMMERCIAL_SEND_NOTICE_ES } from '@/lib/email/corporate-send-policy';
import type { CorporateSender } from '@/lib/email/senders';
import {
  applySignaturePolicy,
  htmlHasEmbeddedSignature,
  stripManagedSignature,
} from '@/lib/email/signature';
import { assertEmailHasAuthoredContent } from '@/lib/email/content-validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ComposerDraft = {
  id: string | null;
  templateSlug: string;
  templateId: string | null;
  templateName?: string;
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
  purpose: 'operational' | 'commercial' | 'institutional' | 'procurement';
  includeSignature?: boolean;
};

type ComposerMode = 'compose' | 'edit-template' | 'new-template';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export function EmailComposer({
  initial,
  initialTemplates = [],
  mode = 'compose',
}: {
  initial: ComposerDraft;
  initialTemplates?: EmailTemplateRow[];
  mode?: ComposerMode;
}) {
  const router = useRouter();
  const isTemplateEditor =
    mode === 'edit-template' || mode === 'new-template';
  const editorRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [draft, setDraft] = React.useState<ComposerDraft>(initial);
  const [templateName, setTemplateName] = React.useState(
    initial.templateName ?? ''
  );
  const [attachments, setAttachments] = React.useState<
    EmailDraftAttachmentRow[]
  >([]);
  const [templates, setTemplates] =
    React.useState<EmailTemplateRow[]>(initialTemplates);
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
  const [confirmMode, setConfirmMode] = React.useState<'send' | 'visual_test'>(
    'send'
  );
  const [allowAttachmentsOnly, setAllowAttachmentsOnly] = React.useState(false);
  const [saveAsTplOpen, setSaveAsTplOpen] = React.useState(false);
  const [tplName, setTplName] = React.useState('');
  const [includeSignature, setIncludeSignature] = React.useState(
    initial.includeSignature ?? !htmlHasEmbeddedSignature(initial.htmlBody)
  );
  /**
   * Plantilla corporativa intacta (fuera del contentEditable libre).
   * Se inicializa si el compose ya viene con plantilla (deep link / selector).
   */
  const [lockedTemplateHtml, setLockedTemplateHtml] = React.useState<
    string | null
  >(() => {
    if (isTemplateEditor) return null;
    const slug = initial.templateSlug || 'blank';
    if (!initial.templateId || slug === 'blank') return null;
    const body = extractComposerEditableHtml(initial.htmlBody || '');
    return body.trim() ? body : null;
  });
  const [portfolioOpen, setPortfolioOpen] = React.useState(false);
  const [portfolioBusy, setPortfolioBusy] = React.useState(false);
  const [portfolioNotice, setPortfolioNotice] = React.useState<string | null>(
    null
  );
  const [portfolioRows, setPortfolioRows] = React.useState<
    PharmacyPortfolioRecipientRow[]
  >([]);
  const [portfolioQuery, setPortfolioQuery] = React.useState('');
  const [sendStatus, setSendStatus] = React.useState<{
    sendEnabled: boolean;
    dryRun: boolean;
    disabledReason: string | null;
    testAllowlistConfigured: boolean;
    testAllowlistCount: number;
  } | null>(null);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : null;

  function renderEditorHtml(
    body: string,
    fromKey: string,
    withSig: boolean,
    locked: string | null = lockedTemplateHtml
  ) {
    const editable = extractComposerEditableHtml(body);
    const shell =
      locked && !isTemplateEditor
        ? buildComposerShellHtml(
            extractNoteAgainstLockedTemplate(editable, locked) ||
              '<p><br/></p>',
            locked
          )
        : editable;
    const applied = applySignaturePolicy({
      htmlBody: shell,
      textBody: '',
      fromKey,
      previewOrigin: origin,
      includeSignature: withSig,
    });
    return applied.html;
  }

  React.useEffect(() => {
    void getCorporateEmailSendStatusAction().then((r) => {
      if (r.ok) {
        setSendStatus({
          sendEnabled: r.sendEnabled,
          dryRun: r.dryRun,
          disabledReason: r.disabledReason,
          testAllowlistConfigured: r.testAllowlistConfigured,
          testAllowlistCount: r.testAllowlistCount,
        });
      }
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
    const withoutSig = stripManagedSignature(raw);
    // Con plantilla bloqueada: persistir nota + plantilla (estado), no el DOM mangled
    const bodyOnly =
      lockedTemplateHtml && !isTemplateEditor
        ? composeTemplateSendBody({
            noteHtml: extractNoteAgainstLockedTemplate(
              withoutSig,
              lockedTemplateHtml
            ),
            lockedTemplateHtml,
          })
        : withoutSig;
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
    if (hasEmbedded) {
      const ok = window.confirm(
        'Esta plantilla incluye una firma. ¿Cambiar el remitente y conservar la firma de la plantilla (sin duplicar)?'
      );
      if (!ok) return;
      patch({ fromKey: nextKey });
      setIncludeSignature(false);
      return;
    }
    const ok = window.confirm(
      'Al cambiar el remitente se aplicará la firma corporativa de esa cuenta. ¿Continuar?'
    );
    if (!ok) return;
    patch({ fromKey: nextKey });
    setIncludeSignature(true);
    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      const body = stripManagedSignature(el.innerHTML);
      el.innerHTML = renderEditorHtml(body, nextKey, true);
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
      const blank = '<p><br/></p>';
      setLockedTemplateHtml(null);
      if (editorRef.current) {
        editorRef.current.innerHTML = renderEditorHtml(
          blank,
          draft.fromKey,
          true,
          null
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
    // Conservar HTML original íntegro. No stripLegacy: destruía tablas de layout.
    const locked = extractComposerEditableHtml(dbTpl.htmlBody);
    const hasSig = htmlHasEmbeddedSignature(locked);
    const useManagedSig =
      dbTpl.includeSignature !== false && !hasSig;
    setIncludeSignature(useManagedSig);
    setLockedTemplateHtml(locked);
    if (editorRef.current) {
      editorRef.current.innerHTML = renderEditorHtml(
        '<p><br/></p>',
        draft.fromKey,
        useManagedSig,
        locked
      );
    }
    patch({
      templateSlug: dbTpl.systemKey || 'custom',
      templateId: dbTpl.id,
      subject: dbTpl.subject,
      htmlBody: locked,
      textBody: dbTpl.textBody || htmlToPlainText(locked),
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

  async function onSaveTemplateEditor() {
    const name = templateName.trim();
    if (!name) {
      toast.error('Indica el nombre interno de la plantilla.');
      return;
    }
    setSaveState('saving');
    const body = stripManagedSignature(
      sanitizeEmailHtml(editorRef.current?.innerHTML || draft.htmlBody)
    );
    const hasEmbedded = htmlHasEmbeddedSignature(body);
    const persistIncludeSig = includeSignature && !hasEmbedded;

    if (mode === 'edit-template' && draft.templateId) {
      const result = await updateEmailTemplateAction({
        templateId: draft.templateId,
        name,
        subject: draft.subject,
        htmlBody: body,
        textBody: htmlToPlainText(body),
        includeSignature: persistIncludeSig,
        purpose: draft.purpose,
      });
      if (!result.ok) {
        setSaveState('error');
        toast.error(result.error);
        return;
      }
      setSaveState('saved');
      toast.success('Cambios guardados en la plantilla.');
      router.push('/emails/templates');
      router.refresh();
      return;
    }

    const result = await saveEmailAsTemplateAction({
      name,
      subject: draft.subject,
      htmlBody: body,
      textBody: htmlToPlainText(body),
      purpose: draft.purpose,
      category: 'personalizada',
    });
    if (!result.ok) {
      setSaveState('error');
      toast.error(result.error);
      return;
    }
    // Persistir preferencia de firma en la nueva plantilla
    if (result.template.includeSignature !== persistIncludeSig) {
      await updateEmailTemplateAction({
        templateId: result.template.id,
        includeSignature: persistIncludeSig,
      });
    }
    setSaveState('saved');
    toast.success('Plantilla creada.');
    router.push('/emails/templates');
    router.refresh();
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

  function editorBodyForSend(): string {
    const raw = sanitizeEmailHtml(
      editorRef.current?.innerHTML || draft.htmlBody
    );
    // Solo quitar firma gestionada del DOM; la plantilla bloqueada va intacta.
    const withoutManaged = stripManagedSignature(raw);
    if (lockedTemplateHtml && !isTemplateEditor) {
      return composeTemplateSendBody({
        noteHtml: extractNoteAgainstLockedTemplate(
          withoutManaged,
          lockedTemplateHtml
        ),
        lockedTemplateHtml,
      });
    }
    return withoutManaged;
  }

  async function openPortfolioPicker() {
    setPortfolioOpen(true);
    setPortfolioBusy(true);
    setPortfolioNotice(null);
    setPortfolioRows([]);
    const result = await listPharmacyPortfolioRecipientsAction({
      query: portfolioQuery,
    });
    setPortfolioBusy(false);
    if (result.ok === false) {
      setPortfolioNotice(result.error);
      return;
    }
    setPortfolioNotice(result.notice);
    setPortfolioRows(result.recipients);
  }

  function openConfirm(mode: 'send' | 'visual_test') {
    const body = editorBodyForSend();
    const gate = assertEmailHasAuthoredContent({
      htmlBody: body,
      textBody: htmlToPlainText(body),
      attachmentCount: attachments.length,
    });
    if (!gate.ok && gate.code === 'empty_body') {
      toast.error(gate.error);
      return;
    }
    setAllowAttachmentsOnly(false);
    setConfirmMode(mode);
    setConfirmOpen(true);
    if (!gate.ok && gate.code === 'attachments_only') {
      toast.message(gate.error);
    }
  }

  async function onConfirmSend() {
    if (sending) return;
    const body = editorBodyForSend();
    const gate = assertEmailHasAuthoredContent({
      htmlBody: body,
      textBody: htmlToPlainText(body),
      attachmentCount: attachments.length,
    });
    if (!gate.ok && gate.code === 'empty_body') {
      toast.error(gate.error);
      return;
    }
    if (
      !gate.ok &&
      gate.code === 'attachments_only' &&
      !allowAttachmentsOnly
    ) {
      toast.error(
        'Marca la casilla de confirmación: envío solo con adjuntos (sin texto).'
      );
      return;
    }

    const isTemplate =
      Boolean(draft.templateSlug) &&
      draft.templateSlug !== 'blank' &&
      draft.templateSlug !== 'custom';
    const visualTest = confirmMode === 'visual_test';

    setSending(true);
    const result = await sendCorporateEmailAction({
      draftId: draft.id,
      explicitConfirm: true,
      purpose: draft.purpose,
      fromKey: draft.fromKey,
      recipientEmail: draft.recipientEmail,
      recipientName: draft.recipientName || null,
      ccEmails: visualTest ? '' : draft.ccEmails,
      bccEmails: visualTest ? '' : draft.bccEmails,
      subject: draft.subject,
      htmlBody: wrapComposerHtmlForSend(body, isTemplate ? 'template' : 'plain'),
      textBody: htmlToPlainText(body),
      templateSlug: draft.templateSlug,
      includeSignature,
      visualTestSend: visualTest,
      allowAttachmentsOnly:
        allowAttachmentsOnly ||
        (gate.ok === false && gate.code === 'attachments_only'),
    });
    setSending(false);
    setConfirmOpen(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      visualTest
        ? 'Prueba visual enviada (asunto [PRUEBA]).'
        : result.dryRun
          ? 'Envío de prueba (dry-run) registrado.'
          : 'Correo enviado.'
    );
    router.push('/emails/sends');
    router.refresh();
  }

  const isCommercialTemplate =
    draft.purpose === 'commercial' ||
    draft.templateSlug === 'demo' ||
    draft.templateSlug === 'piloto';

  const selectedSender =
    senders.find((s) => s.key === draft.fromKey) || senders[0];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        {isTemplateEditor ? (
          <div className="space-y-3 border-b border-border px-4 py-3">
            <div>
              <Label htmlFor="tpl-name" className="text-xs text-muted-foreground">
                Nombre interno
              </Label>
              <Input
                id="tpl-name"
                className="mt-1 h-9"
                value={templateName}
                onChange={(e) => {
                  setTemplateName(e.target.value);
                  setSaveState('dirty');
                }}
                placeholder="Nombre de la plantilla"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === 'edit-template'
                ? 'Estás editando la plantilla original. Guardar cambios conserva el mismo ID.'
                : 'Se creará una plantilla nueva independiente.'}
            </p>
          </div>
        ) : (
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
        )}

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

          {!isTemplateEditor ? (
            <>
              <FieldRow
                label="Para"
                trailing={
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => void openPortfolioPicker()}
                    >
                      Seleccionar de Cartera de farmacias
                    </button>
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
            </>
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

        {lockedTemplateHtml && !isTemplateEditor ? (
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              Nota adicional (editable) · Plantilla corporativa bloqueada debajo
            </p>
            <p className="mt-0.5">
              Escribe solo en la zona superior. El HTML original de la plantilla
              no se modifica al cambiar asunto, destinatario o firma.
            </p>
          </div>
        ) : null}

        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-label={
            lockedTemplateHtml && !isTemplateEditor
              ? 'Nota adicional y plantilla corporativa'
              : 'Cuerpo del mensaje'
          }
          className="min-h-[320px] px-4 py-3 text-sm leading-relaxed outline-none"
          onInput={syncEditorToDraft}
          suppressContentEditableWarning
        />

        {!isTemplateEditor ? (
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
                          setAttachments((p) =>
                            p.filter((x) => x.id !== a.id)
                          );
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
        ) : null}

        {!isTemplateEditor && sendStatus ? (
          <div
            className={
              sendStatus.sendEnabled
                ? 'border-t border-border bg-emerald-500/10 px-4 py-2 text-sm text-emerald-900 dark:text-emerald-100'
                : 'border-t border-border bg-amber-500/10 px-4 py-2 text-sm text-amber-950 dark:text-amber-100'
            }
          >
            {sendStatus.sendEnabled ? (
              <>
                Envío{' '}
                {sendStatus.dryRun
                  ? 'en modo prueba (no sale a Resend).'
                  : 'real habilitado vía Resend.'}{' '}
                {sendStatus.testAllowlistConfigured
                  ? `Destinatarios restringidos a la allowlist de prueba (${sendStatus.testAllowlistCount}).`
                  : 'Falta allowlist de prueba: el backend bloqueará envíos reales.'}{' '}
                No se envía nada hasta que pulses Confirmar.
              </>
            ) : (
              <>
                Enviar deshabilitado.{' '}
                {sendStatus.disabledReason ||
                  'Revisa la configuración del servidor.'}
              </>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/20 px-4 py-3">
          {isTemplateEditor ? (
            <>
              <Button
                type="button"
                disabled={saveState === 'saving'}
                onClick={() => void onSaveTemplateEditor()}
              >
                {mode === 'edit-template'
                  ? 'Guardar cambios'
                  : 'Crear plantilla'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push('/emails/templates')}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                disabled={!sendStatus?.sendEnabled || sending}
                title={
                  !sendStatus?.sendEnabled
                    ? sendStatus?.disabledReason || 'Envío no disponible'
                    : undefined
                }
                onClick={() => openConfirm('send')}
              >
                Enviar
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!sendStatus?.sendEnabled || sending}
                title="Prueba visual SA: allowlist interna, asunto [PRUEBA]"
                onClick={() => openConfirm('visual_test')}
              >
                Enviar prueba
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => void onDiscard()}
              >
                Descartar
              </Button>
            </>
          )}
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
            <h2 className="text-lg font-semibold">
              {confirmMode === 'visual_test'
                ? 'Confirmar envío de prueba'
                : 'Confirmar envío'}
            </h2>
            {confirmMode === 'visual_test' ? (
              <p className="text-sm text-muted-foreground">
                Asunto con prefijo [PRUEBA]. Solo destinatarios de la allowlist
                interna. No registra consentimiento comercial ni contacta
                farmacias. Usa un asunto único para evitar agrupación de Gmail.
              </p>
            ) : null}
            {confirmMode !== 'visual_test' && isCommercialTemplate ? (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                {COMMERCIAL_SEND_NOTICE_ES}
              </p>
            ) : null}
            {lockedTemplateHtml ? (
              <p className="text-xs text-muted-foreground">
                La plantilla corporativa se envía intacta. El texto de la nota
                superior se antepone sin sustituir el diseño.
              </p>
            ) : null}
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
              {confirmMode !== 'visual_test' && draft.ccEmails ? (
                <div>
                  <dt className="text-muted-foreground">CC</dt>
                  <dd className="font-medium">{draft.ccEmails}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Asunto</dt>
                <dd className="font-medium">
                  {confirmMode === 'visual_test' &&
                  !/^\[PRUEBA\]/i.test(draft.subject)
                    ? `[PRUEBA] ${draft.subject || 'Plantilla comercial'}`
                    : draft.subject || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Adjuntos</dt>
                <dd className="font-medium">{attachments.length}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Firma</dt>
                <dd className="font-medium">
                  {includeSignature
                    ? `Sí — ${selectedSender?.signatureName || selectedSender?.displayName || 'corporativa'}`
                    : 'No'}
                </dd>
              </div>
            </dl>
            {attachments.length > 0 &&
            !assertEmailHasAuthoredContent({
              htmlBody: editorBodyForSend(),
              textBody: htmlToPlainText(editorBodyForSend()),
              attachmentCount: attachments.length,
            }).ok ? (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={allowAttachmentsOnly}
                  onChange={(e) => setAllowAttachmentsOnly(e.target.checked)}
                />
                <span>
                  Confirmo el envío <strong>sin texto redactado</strong> (solo
                  adjuntos). La firma no cuenta como contenido.
                </span>
              </label>
            ) : null}
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
                {sending
                  ? 'Enviando…'
                  : confirmMode === 'visual_test'
                    ? 'Confirmar prueba'
                    : 'Confirmar envío'}
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

      <Dialog open={portfolioOpen} onOpenChange={setPortfolioOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cartera de farmacias</DialogTitle>
            <DialogDescription>
              Farmacias con consentimiento comercial vigente (sin campañas
              masivas).
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Buscar por nombre, email o localidad…"
            value={portfolioQuery}
            onChange={(e) => setPortfolioQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void openPortfolioPicker();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={portfolioBusy}
            onClick={() => void openPortfolioPicker()}
          >
            {portfolioBusy ? 'Buscando…' : 'Buscar'}
          </Button>
          {portfolioNotice ? (
            <p className="text-sm text-muted-foreground">{portfolioNotice}</p>
          ) : null}
          {portfolioRows.length > 0 ? (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {portfolioRows.map((r) => (
                <li key={`${r.pharmacyId}-${r.email}`}>
                  <button
                    type="button"
                    className="w-full rounded-md border border-border px-3 py-2 text-left hover:bg-muted/40"
                    onClick={() => {
                      patch({
                        recipientEmail: r.email,
                        recipientName: r.contactName || r.pharmacyName,
                      });
                      setPortfolioOpen(false);
                    }}
                  >
                    <span className="font-medium">{r.pharmacyName}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {r.contactName || '—'} · {r.email}
                      {r.city || r.province
                        ? ` · ${[r.city, r.province].filter(Boolean).join(', ')}`
                        : ''}
                      {' · Auth. '}
                      {new Date(r.authorizedAt).toLocaleDateString('es-ES')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </DialogContent>
      </Dialog>

      {!isTemplateEditor && isCommercialTemplate ? (
        <p className="text-xs text-muted-foreground">{COMMERCIAL_SEND_NOTICE_ES}</p>
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
