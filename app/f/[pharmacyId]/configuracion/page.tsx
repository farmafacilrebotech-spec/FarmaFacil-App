import { PharmacyTenantSettings } from '@/components/pharmacy-tenant/pharmacy-tenant-settings';
import { loadPharmacyTenantContext } from '@/lib/pharmacies/tenant';
import { loadTenantSubscriptionSummary } from '@/lib/pharmacies/tenant-subscription';
import { canViewTenantSubscriptionSummary } from '@/lib/pharmacies/tenant-subscription-summary';

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

  const canViewSubscription = canViewTenantSubscriptionSummary(
    result.context.membership.roleKey
  );
  const subscriptionSummary = canViewSubscription
    ? await loadTenantSubscriptionSummary(params.pharmacyId)
    : null;

  return (
    <PharmacyTenantSettings
      context={result.context}
      subscriptionSummary={subscriptionSummary}
    />
  );
}
