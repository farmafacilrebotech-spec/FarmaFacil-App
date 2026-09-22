import { redirect } from 'next/navigation';

import { loadPharmacyTenantContext } from '@/lib/pharmacies/tenant';
import { PharmacyTenantShell } from '@/components/pharmacy-tenant/pharmacy-tenant-shell';

export const dynamic = 'force-dynamic';

/**
 * Layout tenant: aislado del panel SuperAdmin ((app)).
 * Solo membership active para este pharmacyId.
 */
export default async function PharmacyTenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { pharmacyId: string };
}) {
  const result = await loadPharmacyTenantContext(params.pharmacyId);

  if (!result.ok) {
    if (result.reason === 'unauthenticated') {
      redirect('/login');
    }
    redirect('/access-denied');
  }

  return (
    <PharmacyTenantShell context={result.context}>{children}</PharmacyTenantShell>
  );
}
