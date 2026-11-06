import { headers } from 'next/headers';
import { Mail } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/shared/page-header';
import { CorporateEmailPreview } from '@/components/email/corporate-email-preview';
import {
  FF_LOGO_URL,
  FF_PHOTO_LOCAL_PATH,
  FF_PHOTO_PUBLIC_URL,
  normalizeFfPreviewOrigin,
} from '@/lib/email/corporate-shared';
import {
  PHARMACY_PILOT_TEMPLATE_ID,
  buildPharmacyPilotEmail,
} from '@/lib/email/pharmacy-pilot';
import { requestPublicOriginFromHeaders } from '@/lib/auth/request-origin';
import { CANONICAL_PRODUCTION_APP_URL } from '@/lib/auth/app-url';

export const dynamic = 'force-dynamic';

export default async function PharmacyPilotEmailPreviewPage() {
  const h = headers();
  const origin = normalizeFfPreviewOrigin(
    requestPublicOriginFromHeaders(h, CANONICAL_PRODUCTION_APP_URL)
  );

  const preview = buildPharmacyPilotEmail({
    imageMode: 'preview',
    previewOrigin: origin,
  });
  const send = buildPharmacyPilotEmail({ imageMode: 'send' });

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
        title="Invitación piloto"
        description="Programa piloto de 30 días. Sin envío."
      />

      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        <p className="font-medium">
          Envío bloqueado · {PHARMACY_PILOT_TEMPLATE_ID}
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
          <div className="text-xs text-muted-foreground">
            <p>
              Foto: <code>{FF_PHOTO_LOCAL_PATH}</code>
            </p>
          </div>
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
        iframeTitle="Vista previa email piloto"
      />

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Mail className="h-3.5 w-3.5" />
        Resend existente · sin cablear envío.
      </p>
    </div>
  );
}
