import { headers } from 'next/headers';
import { Mail } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/shared/page-header';
import { LanzaderaEmailPreview } from '@/components/email/lanzadera-email-preview';
import {
  buildLanzaderaOutreachEmail,
  normalizeLanzaderaPreviewOrigin,
  LANZADERA_LOGO_URL,
  LANZADERA_PHOTO_LOCAL_PATH,
  LANZADERA_PHOTO_PUBLIC_URL,
  LANZADERA_MODULE_ICON_PATHS,
} from '@/lib/email/lanzadera-outreach';
import { requestPublicOriginFromHeaders } from '@/lib/auth/request-origin';
import { CANONICAL_PRODUCTION_APP_URL } from '@/lib/auth/app-url';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';

export const dynamic = 'force-dynamic';

/**
 * Vista previa SuperAdmin del email corporativo a Lanzadera.
 * No envía correo. sendEnabled permanece false.
 */
export default async function LanzaderaEmailPreviewPage() {
  await assertEmailsPageAccess();
  const h = headers();
  // Normaliza https://localhost → http://localhost (evita imágenes rotas en iframe).
  const origin = normalizeLanzaderaPreviewOrigin(
    requestPublicOriginFromHeaders(h, CANONICAL_PRODUCTION_APP_URL)
  );

  const preview = buildLanzaderaOutreachEmail({
    imageMode: 'preview',
    previewOrigin: origin,
  });
  const send = buildLanzaderaOutreachEmail({
    imageMode: 'send',
  });

  const mailboxWarning =
    'From/Reply-To preparados como «Pilar Reyes · FarmaFácil <pilar@farmafacil.solutions>». ' +
    'El dominio farmafacil.solutions está verificado en Resend según la configuración del proyecto, ' +
    'pero desde este entorno no se puede confirmar que el buzón pilar@ reciba respuestas ' +
    '(buzón IMAP/Google Workspace u otro receptor). Conviene verificarlo antes del envío real.';

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6">
      <div className="text-sm">
        <Link
          href="/emails"
          className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          ← Emails corporativos
        </Link>
      </div>
      <PageHeader
        title="Email Lanzadera"
        description="Plantilla corporativa FarmaFácil. Sin envío hasta autorización expresa."
      />

      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        <p className="font-medium">Envío bloqueado · ff-lanzadera-outreach-v3</p>
        <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
          Remitente: <code className="text-xs">{preview.from}</code> · Reply-To:{' '}
          <code className="text-xs">{preview.replyTo}</code>
        </p>
      </div>

      {/* Diagnóstico de assets locales (fuera del iframe) */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Diagnóstico de imágenes (origen local)
        </p>
        <div className="flex flex-wrap items-end gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LANZADERA_PHOTO_LOCAL_PATH}
            width={80}
            height={80}
            alt=""
            className="h-20 w-20 rounded-full object-cover"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LANZADERA_MODULE_ICON_PATHS.catalog}
            width={48}
            height={48}
            alt=""
            className="h-12 w-12 object-contain"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LANZADERA_MODULE_ICON_PATHS.orders}
            width={48}
            height={48}
            alt=""
            className="h-12 w-12 object-contain"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LANZADERA_MODULE_ICON_PATHS.kiosk}
            width={48}
            height={48}
            alt=""
            className="h-12 w-12 object-contain"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LANZADERA_MODULE_ICON_PATHS.assistant}
            width={48}
            height={48}
            alt=""
            className="h-12 w-12 object-contain"
          />
          <div className="text-xs text-muted-foreground">
            <p>
              Foto: <code>{LANZADERA_PHOTO_LOCAL_PATH}</code>
            </p>
            <p className="mt-1">
              Iconos: kiosk-qr / kiosk-cart / kiosk-search / kiosk-ai
            </p>
            <p className="mt-1">
              Si estas miniaturas cargan y el iframe no, el HTML del iframe es
              el fallo a corregir (no el archivo).
            </p>
          </div>
        </div>
      </div>

      <LanzaderaEmailPreview
        subject={preview.subject}
        htmlPreview={preview.html}
        htmlSend={send.html}
        text={preview.text}
        from={preview.from}
        replyTo={preview.replyTo}
        photoPreviewUrl={preview.photoUrl}
        photoSendUrl={LANZADERA_PHOTO_PUBLIC_URL}
        logoUrl={LANZADERA_LOGO_URL}
        mailboxWarning={mailboxWarning}
      />

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Mail className="h-3.5 w-3.5" />
        Resend existente (`lib/email/send.ts`) · sin cablear envío.
      </p>
    </div>
  );
}
