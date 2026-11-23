import { redirect } from 'next/navigation';

import { HelpCenterHub } from '@/components/help/help-center-hub';
import { PageHeader } from '@/components/shared/page-header';
import {
  filterHelpDocsForAudiences,
  resolveHelpAudiencesForPharmacy,
} from '@/lib/help/access';

export const dynamic = 'force-dynamic';

/**
 * Centro de ayuda dentro del panel de farmacia.
 * Audiencias derivadas del rol (membership active); sin pruebas internas.
 */
export default async function PharmacyHelpPage({
  params,
}: {
  params: { pharmacyId: string };
}) {
  const resolved = await resolveHelpAudiencesForPharmacy(params.pharmacyId);
  if (!resolved.ok) {
    redirect(resolved.reason === 'unauthenticated' ? '/login' : '/access-denied');
  }

  const docs = filterHelpDocsForAudiences(resolved.audiences);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Ayuda"
        description="Manuales, primeros pasos y soporte para tu farmacia"
      />
      <HelpCenterHub
        docs={docs}
        isSuperAdminTotal={false}
        basePath={`/f/${params.pharmacyId}/ayuda`}
        showStubs
      />
    </div>
  );
}
