import { notFound } from 'next/navigation';

import {
  getPharmacyById,
  listActivePlans,
  listPharmacyMembers,
  listPharmacyRoles,
} from '@/lib/pharmacies/queries';
import { listPharmacyProducts } from '@/lib/pharmacies/products';
import { listPharmacyKioskDevices } from '@/lib/kiosk/devices';
import { getPharmacyKioskEntitlement } from '@/lib/kiosk/entitlement';
import { PharmacyDetailClient } from '@/components/pharmacies/pharmacy-detail-client';
import { getCurrentProfile } from '@/lib/auth/platform';
import { buildPharmacyUsersCapabilities } from '@/lib/pharmacies/membership-capabilities';

export const dynamic = 'force-dynamic';

export default async function PharmacyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [
    pharmacy,
    plans,
    members,
    roles,
    catalog,
    kiosk,
    kioskEnt,
    profileResult,
  ] = await Promise.all([
    getPharmacyById(params.id),
    listActivePlans(),
    listPharmacyMembers(params.id),
    listPharmacyRoles(),
    listPharmacyProducts(params.id, { status: 'all' }),
    listPharmacyKioskDevices(params.id),
    getPharmacyKioskEntitlement(params.id),
    getCurrentProfile(),
  ]);

  if (!pharmacy) {
    notFound();
  }

  const actorProfileId = profileResult.profile?.id ?? '';
  const usersCapabilities = buildPharmacyUsersCapabilities({
    actor: { kind: 'platform', profileId: actorProfileId },
    roles,
  });

  return (
    <PharmacyDetailClient
      pharmacy={pharmacy}
      plans={plans}
      members={members}
      roles={roles}
      usersCapabilities={usersCapabilities}
      catalogProducts={catalog.ok ? catalog.products : []}
      catalogCategories={catalog.ok ? catalog.categories : []}
      catalogLoadError={catalog.ok ? null : catalog.error}
      kioskDevices={kiosk.ok ? kiosk.devices : []}
      kioskDevicesError={kiosk.ok ? null : kiosk.error}
      kioskCommercialUiState={kioskEnt.uiState}
      kioskEntitlement={kioskEnt.entitlement}
      kioskModuleUsable={kioskEnt.moduleUsable}
    />
  );
}
