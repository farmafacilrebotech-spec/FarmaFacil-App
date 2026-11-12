import { headers } from 'next/headers';

import { EmailsShell } from '@/components/email/emails-shell';
import { TemplatesPanel } from '@/components/email/templates-panel';
import {
  ensureSystemEmailTemplatesAction,
  listEmailTemplatesAction,
} from '@/app/(app)/emails/actions';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';
import { requestPublicOriginFromHeaders } from '@/lib/auth/request-origin';
import { CANONICAL_PRODUCTION_APP_URL } from '@/lib/auth/app-url';
import { normalizeFfPreviewOrigin } from '@/lib/email/corporate-templates';

export const dynamic = 'force-dynamic';

export default async function EmailTemplatesPage() {
  await assertEmailsPageAccess();
  const origin = normalizeFfPreviewOrigin(
    requestPublicOriginFromHeaders(headers(), CANONICAL_PRODUCTION_APP_URL)
  );
  // Solo siembra si faltan; nunca regenera contenido editado
  await ensureSystemEmailTemplatesAction(origin);
  const listed = await listEmailTemplatesAction({ includeArchived: true });
  const templates = listed.ok ? listed.templates : [];

  return (
    <EmailsShell title="Plantillas">
      {!listed.ok ? (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {listed.error}
        </div>
      ) : null}
      <TemplatesPanel templates={templates} />
    </EmailsShell>
  );
}
