import { headers } from 'next/headers';
import { Mail } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/shared/page-header';
import { CorporateEmailPreview } from '@/components/email/corporate-email-preview';
import {
  FF_LOGO_URL,
  FF_MODULE_ICON_PATHS,
  FF_PHOTO_LOCAL_PATH,
  FF_PHOTO_PUBLIC_URL,
  normalizeFfPreviewOrigin,
} from '@/lib/email/corporate-shared';
import {
  PHARMACY_DEMO_TEMPLATE_ID,
  buildPharmacyDemoEmail,
} from '@/lib/email/pharmacy-demo';
import { requestPublicOriginFromHeaders } from '@/lib/auth/request-origin';
import { CANONICAL_PRODUCTION_APP_URL } from '@/lib/auth/app-url';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';

export const dynamic = 'force-dynamic';

export default async function PharmacyDemoEmailPreviewPage() {
  await assertEmailsPageAccess();
  const h = headers();
  const origin = normalizeFfPreviewOrigin(
    requestPublicOriginFromHeaders(h, CANONICAL_PRODUCTION_APP_URL)
  );

  const preview = buildPharmacyDemoEmail({
    imageMode: 'preview',
    previewOrigin: origin,
  });
  const send = buildPharmacyDemoEmail({ imageMode: 'send' });

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
        title="Invitación demostración"
        description="Invitar a farmacias a conocer FarmaFácil. Sin envío."
      />

      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        <p className="font-medium">
          Envío bloqueado · {PHARMACY_DEMO_TEMPLATE_ID}
        </p>
        <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
          Remitente: <code className="text-xs">{preview.from}</code>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Diagnóstico de imágenes
        </p>
        <div className="flex flex-wrap items-end gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FF_PHOTO_LOCAL_PATH}
            width={80}
            height={80}
            alt=""
            className="h-20 w-20 rounded-full object-cover"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FF_MODULE_ICON_PATHS.catalog}
            width={48}
            height={48}
            alt=""
            className="h-12 w-12 object-contain"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FF_MODULE_ICON_PATHS.orders}
            width={48}
            height={48}
            alt=""
            className="h-12 w-12 object-contain"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FF_MODULE_ICON_PATHS.kiosk}
            width={48}
            height={48}
            alt=""
            className="h-12 w-12 object-contain"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FF_MODULE_ICON_PATHS.assistant}
            width={48}
            height={48}
            alt=""
            className="h-12 w-12 object-contain"
          />
        </div>
      </div>

      <CorporateEmailPreview
        templateId={preview.templateId}
        subject={preview.subject}
        htmlPreview={preview.html}
        htmlSend={send.html}
        text={preview.text}
        from={preview.from}
        replyTo={preview.replyTo}
        photoPreviewUrl={preview.photoUrl}
        photoSendUrl={FF_PHOTO_PUBLIC_URL}
        logoUrl={FF_LOGO_URL}
        iframeTitle="Vista previa email demostración"
      />

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Mail className="h-3.5 w-3.5" />
        Resend existente · sin cablear envío.
      </p>
    </div>
  );
}
