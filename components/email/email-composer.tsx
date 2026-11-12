'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import {
  deleteEmailDraftAction,
  getComposeSeedAction,
  getCorporateEmailSendStatusAction,
  saveEmailDraftAction,
  sendCorporateEmailAction,
} from '@/app/(app)/emails/actions';
import {
  EMAIL_TEMPLATE_OPTIONS,
  type EmailTemplateSlug,
} from '@/lib/email/compose-catalog';
import {
  defaultPurposeForTemplate,
  type EmailLegalBasis,
  type EmailPurpose,
} from '@/lib/email/corporate-send-policy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type ComposerDraft = {
  id: string | null;
  templateSlug: EmailTemplateSlug;
  subject: string;
  htmlBody: string;
  textBody: string;
  recipientEmail: string;
  recipientName: string;
  from: string;
  replyTo: string;
  purpose: EmailPurpose;
  legalBasis: EmailLegalBasis | '';
  commercialAuthAck: boolean;
  oppositionChecked: boolean;
};

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export function EmailComposer({
  initial,
}: {
  initial: ComposerDraft;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<ComposerDraft>(initial);
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [previewTab, setPreviewTab] = React.useState<'html' | 'text'>('html');
  const [busyTemplate, setBusyTemplate] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [sendStatus, setSendStatus] = React.useState<{
    sendEnabled: boolean;
    dryRun: boolean;
    resendConfigured: boolean;
    fromConfigured: boolean;
    missing: string[];
  } | null>(null);

  React.useEffect(() => {
    void getCorporateEmailSendStatusAction().then((r) => {
      if (r.ok) {
        setSendStatus({
          sendEnabled: r.sendEnabled,
          dryRun: r.dryRun,
          resendConfigured: r.resendConfigured,
          fromConfigured: r.fromConfigured,
          missing: r.missing,
        });
      }
    });
  }, []);

  function patch(partial: Partial<ComposerDraft>) {
    setDraft((d) => ({ ...d, ...partial }));
    setSaveState('dirty');
    setSaveError(null);
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
    patch({
      templateSlug: result.seed.templateSlug,
      subject: result.seed.subject,
      htmlBody: result.seed.htmlBody,
      textBody: result.seed.textBody,
      from: result.seed.from,
      replyTo: result.seed.replyTo,
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
      textBody: draft.textBody,
      recipientEmail: draft.recipientEmail,
      recipientName: draft.recipientName || null,
      purpose: draft.purpose,
      legalBasis: draft.legalBasis || null,
      commercialAuthAck: draft.commercialAuthAck,
      oppositionChecked: draft.oppositionChecked,
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

  async function onConfirmSend() {
    setSending(true);
    const result = await sendCorporateEmailAction({
      draftId: draft.id,
      explicitConfirm: true,
      purpose: draft.purpose,
      legalBasis: draft.legalBasis || null,
      commercialAuthAck: draft.commercialAuthAck,
      oppositionChecked: draft.oppositionChecked,
      recipientEmail: draft.recipientEmail,
      recipientName: draft.recipientName || null,
      subject: draft.subject,
      htmlBody: draft.htmlBody,
      textBody: draft.textBody,
      templateSlug: draft.templateSlug,
    });
    setSending(false);
    setConfirmOpen(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      result.dryRun
        ? `Dry-run OK (outbox ${result.sendId.slice(0, 8)}…). No se llamó a Resend.`
        : `Enviado (${result.sendId.slice(0, 8)}…).`
    );
    router.push('/emails/sends');
    router.refresh();
  }

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
    ? 'Comprobando configuración de envío…'
    : !sendStatus.sendEnabled
      ? 'Envío desactivado en servidor (FF_CORPORATE_EMAIL_SEND_ENABLED). Puedes guardar borradores.'
      : sendStatus.dryRun
        ? 'Envío en modo dry-run: registra outbox sin llamar a Resend.'
        : 'Envío real habilitado (DRY_RUN=0). Confirma antes de enviar.';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        <div>
          <p className="font-medium">Emails corporativos · Fase B (1:1)</p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            Remitente: {draft.from} · Reply-To: {draft.replyTo}
          </p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            {sendBanner}
          </p>
        </div>
        <p className="text-xs font-medium uppercase tracking-wide">{statusLabel}</p>
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
            <Label htmlFor="purpose">Tipo de comunicación</Label>
            <select
              id="purpose"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={draft.purpose}
              onChange={(e) =>
                patch({ purpose: e.target.value as EmailPurpose })
              }
            >
              <option value="operational">Operativa (servicio)</option>
              <option value="commercial">Comercial (marketing/prospección)</option>
            </select>
          </div>

          {draft.purpose === 'commercial' ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
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
                  He comprobado oposición/bajas (lista de exclusión) para este
                  destinatario.
                </span>
              </label>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="to">Destinatario (individual)</Label>
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
            <Label htmlFor="html">Cuerpo HTML</Label>
            <Textarea
              id="html"
              value={draft.htmlBody}
              onChange={(e) => patch({ htmlBody: e.target.value })}
              className="min-h-[220px] font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="text">Cuerpo texto</Label>
            <Textarea
              id="text"
              value={draft.textBody}
              onChange={(e) => patch({ textBody: e.target.value })}
              className="min-h-[120px] font-mono text-xs"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Adjuntos: preparados en Fase B (PDF/PNG/JPG/DOCX ≤5&nbsp;MB, máx. 5).
            La UI de subida se activará tras validar Storage en staging; el
            envío actual es sin adjuntos.
          </p>

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
              {sendStatus?.sendEnabled
                ? sendStatus.dryRun
                  ? 'Enviar (dry-run)…'
                  : 'Enviar…'
                : 'Enviar (desactivado)'}
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
              <Link href="/emails/drafts">Ver borradores</Link>
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
              <dt className="text-xs text-muted-foreground">Asunto</dt>
              <dd className="font-medium">{draft.subject || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Para</dt>
              <dd className="font-medium">
                {draft.recipientEmail || '—'}
                {draft.recipientName ? ` (${draft.recipientName})` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Tipo</dt>
              <dd className="font-medium">
                {draft.purpose === 'commercial' ? 'Comercial' : 'Operativa'}
              </dd>
            </div>
          </dl>
          {previewTab === 'html' ? (
            <iframe
              title="Vista previa HTML"
              className="h-[520px] w-full rounded-lg border border-border bg-white"
              sandbox=""
              srcDoc={draft.htmlBody}
            />
          ) : (
            <pre className="h-[520px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-xs">
              {draft.textBody || '—'}
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
                ? ' Se registrará en outbox en dry-run, sin Resend.'
                : ' Se enviará de verdad vía Resend.'}
            </p>
            <dl className="space-y-1 text-sm">
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
                  {draft.purpose === 'commercial' ? 'Comercial' : 'Operativa'}
                </dd>
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
