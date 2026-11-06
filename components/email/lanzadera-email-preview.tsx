'use client';

import * as React from 'react';

/**
 * Vista previa del HTML Lanzadera.
 * Mismo HTML que el envío; solo cambia la resolución de imágenes.
 * No dispara envíos.
 */
export function LanzaderaEmailPreview({
  subject,
  htmlPreview,
  htmlSend,
  text,
  from,
  replyTo,
  photoPreviewUrl,
  photoSendUrl,
  logoUrl,
  mailboxWarning,
}: {
  subject: string;
  /** HTML de preview (imágenes locales; el cliente las ancla al origen actual). */
  htmlPreview: string;
  /** HTML idéntico en estructura con URLs HTTPS (el que se enviaría). */
  htmlSend: string;
  text: string;
  from: string;
  replyTo: string;
  photoPreviewUrl: string;
  photoSendUrl: string;
  logoUrl: string;
  mailboxWarning?: string | null;
}) {
  const [tab, setTab] = React.useState<'html' | 'text' | 'send-source'>('html');
  const [viewport, setViewport] = React.useState<'desktop' | 'mobile'>('desktop');

  /**
   * srcDoc + rutas relativas fallaban cuando el servidor inyectaba
   * <base href="https://localhost:…"> (proto tomado del fallback de prod).
   * Reescribimos /images/… al origen real del navegador (http://localhost|127…).
   */
  const htmlForIframe = React.useMemo(() => {
    if (typeof window === 'undefined') return htmlPreview;
    const origin = window.location.origin.replace(/\/$/, '');
    return htmlPreview
      .replace(/<base\b[^>]*>/gi, '')
      .replace(
        /src="https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/images\/[^"]+)"/gi,
        (_m, path: string) => `src="${origin}${path}"`
      )
      .replace(/src="(\/images\/[^"]+)"/g, (_m, path: string) => `src="${origin}${path}"`);
  }, [htmlPreview]);

  return (
    <div className="space-y-4">
      <dl className="grid gap-2 rounded-xl border border-border bg-card p-4 text-sm shadow-soft sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Asunto</dt>
          <dd className="mt-0.5 font-medium text-foreground">{subject}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">From</dt>
          <dd className="mt-0.5 font-medium text-foreground">{from}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Reply-To</dt>
          <dd className="mt-0.5 font-medium text-foreground">{replyTo}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Logo</dt>
          <dd className="mt-0.5 break-all text-xs">
            <a
              href={logoUrl}
              className="text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {logoUrl}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Foto (vista previa · ruta local)
          </dt>
          <dd className="mt-0.5 break-all text-xs">
            <a
              href={photoPreviewUrl}
              className="text-primary underline-offset-2 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {photoPreviewUrl}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">
            Foto (HTML de envío · HTTPS)
          </dt>
          <dd className="mt-0.5 break-all text-xs">
            <span className="text-foreground">{photoSendUrl}</span>
          </dd>
        </div>
      </dl>

      {mailboxWarning ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          {mailboxWarning}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('html')}
          className={
            tab === 'html'
              ? 'rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
              : 'rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground'
          }
        >
          Vista HTML
        </button>
        <button
          type="button"
          onClick={() => setTab('text')}
          className={
            tab === 'text'
              ? 'rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
              : 'rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground'
          }
        >
          Texto plano
        </button>
        <button
          type="button"
          onClick={() => setTab('send-source')}
          className={
            tab === 'send-source'
              ? 'rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground'
              : 'rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground'
          }
        >
          HTML de envío (HTTPS)
        </button>
        <span className="mx-1 hidden h-8 w-px bg-border sm:inline-block" />
        <button
          type="button"
          onClick={() => setViewport('desktop')}
          className={
            viewport === 'desktop'
              ? 'rounded-lg bg-muted px-3 py-1.5 text-sm font-medium'
              : 'rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground'
          }
        >
          Escritorio
        </button>
        <button
          type="button"
          onClick={() => setViewport('mobile')}
          className={
            viewport === 'mobile'
              ? 'rounded-lg bg-muted px-3 py-1.5 text-sm font-medium'
              : 'rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground'
          }
        >
          Móvil
        </button>
      </div>

      {tab === 'html' ? (
        <div className="overflow-auto rounded-xl border border-border bg-muted/30 p-3 shadow-soft">
          <div
            className="mx-auto overflow-hidden rounded-lg bg-white shadow-sm"
            style={{
              width: viewport === 'mobile' ? 390 : '100%',
              maxWidth: viewport === 'desktop' ? 640 : 390,
            }}
          >
            <iframe
              title="Vista previa email Lanzadera"
              srcDoc={htmlForIframe}
              className="h-[min(1100px,92vh)] w-full border-0 bg-white"
              sandbox="allow-same-origin allow-popups"
            />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Misma plantilla que el envío; en vista previa los iconos y la firma
            se resuelven al origen local del navegador (URL absolutas).
          </p>
        </div>
      ) : null}

      {tab === 'text' ? (
        <pre className="max-h-[min(920px,85vh)] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-card p-4 text-sm text-foreground shadow-soft">
          {text}
        </pre>
      ) : null}

      {tab === 'send-source' ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Fuente HTML para Resend (URLs HTTPS). La foto de firma solo cargará
            en bandejas cuando el asset esté publicado (HTTP 200).
          </p>
          <pre className="max-h-[min(640px,70vh)] overflow-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-card p-4 text-[11px] leading-relaxed text-foreground shadow-soft">
            {htmlSend}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
