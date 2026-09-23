import { PharmacyTenantSettings } from '@/components/pharmacy-tenant/pharmacy-tenant-settings';
import { loadPharmacyTenantContext } from '@/lib/pharmacies/tenant';

export const dynamic = 'force-dynamic';

export default async function PharmacyConfiguracionPage({
  params,
}: {
  params: { pharmacyId: string };
}) {
  const result = await loadPharmacyTenantContext(params.pharmacyId);
  if (!result.ok) {
    return null;
  }

  return <PharmacyTenantSettings context={result.context} />;
}
