import { notFound, redirect } from 'next/navigation';

import { HelpDocView } from '@/components/help/help-doc-view';
import { canAccessHelpDocForPharmacy } from '@/lib/help/access';

export const dynamic = 'force-dynamic';

export default async function PharmacyHelpDocPage({
  params,
}: {
  params: { pharmacyId: string; docId: string };
}) {
  const access = await canAccessHelpDocForPharmacy(
    params.pharmacyId,
    params.docId
  );
  if (!access.ok) {
    if (access.reason === 'unauthenticated') redirect('/login');
    if (access.reason === 'not_found') notFound();
    redirect('/access-denied');
  }

  return (
    <HelpDocView
      doc={access.doc}
      backHref={`/f/${params.pharmacyId}/ayuda`}
    />
  );
}
