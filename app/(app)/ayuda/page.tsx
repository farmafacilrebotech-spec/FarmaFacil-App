import { redirect } from 'next/navigation';

import { HelpCenterHub } from '@/components/help/help-center-hub';
import { PageHeader } from '@/components/shared/page-header';
import {
  listVisibleHelpDocs,
  resolveHelpAudiences,
} from '@/lib/help/access';

export const dynamic = 'force-dynamic';

export default async function AyudaPage() {
  const { authenticated, audiences } = await resolveHelpAudiences();
  if (!authenticated) redirect('/login?next=/ayuda');

  const docs = await listVisibleHelpDocs();
  const isSuperAdminTotal = audiences.includes('sa_total');

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Centro de ayuda"
        description="Manuales, novedades y soporte según tu perfil"
      />
      <HelpCenterHub docs={docs} isSuperAdminTotal={isSuperAdminTotal} />
    </div>
  );
}
