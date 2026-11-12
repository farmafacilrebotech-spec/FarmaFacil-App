import { EmailsShell } from '@/components/email/emails-shell';
import { TemplatesPanel } from '@/components/email/templates-panel';
import { listEmailTemplatesAction } from '@/app/(app)/emails/actions';
import { assertEmailsPageAccess } from '@/lib/email/emails-page-gate';

export const dynamic = 'force-dynamic';

const SYSTEM = [
  {
    slug: 'lanzadera',
    title: 'Lanzadera',
    description: 'Informe de evolución e incorporación a Lanzadera.',
    previewHref: '/emails/lanzadera',
  },
  {
    slug: 'imprentas',
    title: 'Presupuesto imprentas',
    description: 'Solicitud de presupuesto de material corporativo.',
    previewHref: '/emails/imprentas',
  },
  {
    slug: 'demo',
    title: 'Invitación demostración',
    description: 'Invitar a farmacias a conocer y probar FarmaFácil.',
    previewHref: '/emails/demo',
  },
  {
    slug: 'piloto',
    title: 'Invitación piloto',
    description: 'Invitación al programa piloto de 30 días.',
    previewHref: '/emails/piloto',
  },
] as const;

export default async function EmailTemplatesPage() {
  await assertEmailsPageAccess();
  const listed = await listEmailTemplatesAction();
  const templates = listed.ok ? listed.templates : [];

  return (
    <EmailsShell
      title="Plantillas"
      description="Editables visualmente. Usar una plantilla copia el contenido al correo; no modifica el original."
    >
      {!listed.ok && listed.code === 'migration_pending' ? (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {listed.error} Las plantillas de sistema siguen disponibles abajo.
        </div>
      ) : null}
      <TemplatesPanel templates={templates} systemCards={[...SYSTEM]} />
    </EmailsShell>
  );
}
