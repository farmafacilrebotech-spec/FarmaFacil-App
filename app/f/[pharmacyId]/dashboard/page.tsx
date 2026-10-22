import { PharmacyTenantDashboard } from '@/components/pharmacy-tenant/pharmacy-tenant-dashboard';
import { loadPharmacyTenantDashboardStats } from '@/lib/orders/tenant-dashboard-stats';
import { loadPharmacyTenantContext } from '@/lib/pharmacies/tenant';

export const dynamic = 'force-dynamic';

export default async function PharmacyDashboardPage({
  params,
}: {
  params: { pharmacyId: string };
}) {
  const result = await loadPharmacyTenantContext(params.pharmacyId);
  if (!result.ok) {
    return null;
  }

  const stats = await loadPharmacyTenantDashboardStats(params.pharmacyId);

  return (
    <PharmacyTenantDashboard context={result.context} stats={stats} />
  );
}
