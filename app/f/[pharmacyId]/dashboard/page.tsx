import { PharmacyTenantDashboard } from '@/components/pharmacy-tenant/pharmacy-tenant-dashboard';
import { loadPharmacyTenantContext } from '@/lib/pharmacies/tenant';

export const dynamic = 'force-dynamic';

export default async function PharmacyDashboardPage({
  params,
}: {
  params: { pharmacyId: string };
}) {
  // El layout ya validó membership; recargamos contexto para la página.
  const result = await loadPharmacyTenantContext(params.pharmacyId);

  if (!result.ok) {
    return null;
  }

  return <PharmacyTenantDashboard context={result.context} />;
}
