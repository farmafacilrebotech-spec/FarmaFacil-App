import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import {
  getPharmacyById,
  listActivePlans,
  listPharmacyMembers,
  listPharmacyRoles,
} from '@/lib/pharmacies/queries';
import {
  getLaunch2027SeatsSummary,
  getPharmacyLaunchSeatDetail,
  listLaunchSeatEvents,
} from '@/lib/pharmacies/launch-seats';
import {
  getCurrentProfile,
  hasPlatformSuperAdminRole,
} from '@/lib/auth/platform';
import { listPharmacyProducts } from '@/lib/pharmacies/products';
import {
  getPharmacyCatalogMode,
  pharmacyHasMasterCatalogProjection,
} from '@/lib/pharmacies/catalog-mode';
import { listPharmacyKioskDevices } from '@/lib/kiosk/devices';
import { getPharmacyKioskEntitlement } from '@/lib/kiosk/entitlement';
import { getPharmacyAssistantEntitlement } from '@/lib/kiosk/assistant/entitlement';
import { getPharmacyAssistantUsageCurrentMonth } from '@/lib/kiosk/assistant/settings';
import { loadOrEnsurePharmacyHomeEntrypoint } from '@/lib/pharmacies/pharmacy-home-entrypoint';
import { isStagingQrEnvironment } from '@/lib/pharmacies/print-entrypoint-url';
import { canGeneratePharmacyMaterials } from '@/lib/pharmacies/pharmacy-materials-access';
import { PharmacyDetailClient } from '@/components/pharmacies/pharmacy-detail-client';
import { buildPharmacyUsersCapabilities } from '@/lib/pharmacies/membership-capabilities';
import { requireOrdersView } from '@/lib/orders/authz';
import { listPharmacyOrders } from '@/lib/orders/queries';
import type { PharmacyOrderSummary } from '@/lib/orders/types';
import { listSaCustomersForPharmacy } from '@/lib/platform/sa-customers';
import type { SaCustomerRow } from '@/lib/platform/sa-customers';

export const dynamic = 'force-dynamic';

const PHARMACY_TABS = [
  'general',
  'personalizacion',
  'contrato',
  'qr',
  'usuarios',
  'clientes',
  'catalogo',
  'kiosko',
  'asistente',
  'pedidos',
  'actividad',
] as const;

export default async function PharmacyDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { tab?: string };
}) {
  const pharmacyId = params.id;
  const tabParam = (searchParams?.tab || '').trim();
  const initialTab = (PHARMACY_TABS as readonly string[]).includes(tabParam)
    ? tabParam
    : 'general';

  const [
    pharmacy,
    plans,
    launchSeats,
    launchSeatDetail,
    launchSeatEvents,
    members,
    roles,
    catalog,
    catalogMode,
    hasMasterProjection,
    kiosk,
    kioskEnt,
    assistantEnt,
    assistantUsage,
    profileResult,
    homeQr,
    ordersView,
    customersResult,
  ] = await Promise.all([
    getPharmacyById(pharmacyId),
    listActivePlans(),
    getLaunch2027SeatsSummary(pharmacyId),
    getPharmacyLaunchSeatDetail(pharmacyId),
    listLaunchSeatEvents(30, pharmacyId),
    listPharmacyMembers(pharmacyId),
    listPharmacyRoles(),
    listPharmacyProducts(pharmacyId, { status: 'all' }),
    getPharmacyCatalogMode(pharmacyId),
    pharmacyHasMasterCatalogProjection(pharmacyId),
    listPharmacyKioskDevices(pharmacyId),
    getPharmacyKioskEntitlement(pharmacyId),
    getPharmacyAssistantEntitlement(pharmacyId),
    getPharmacyAssistantUsageCurrentMonth(pharmacyId),
    getCurrentProfile(),
    loadOrEnsurePharmacyHomeEntrypoint(pharmacyId),
    requireOrdersView(pharmacyId),
    listSaCustomersForPharmacy(pharmacyId, 100),
  ]);

  if (!pharmacy) {
    notFound();
  }

  let orders: PharmacyOrderSummary[] = [];
  let ordersError: string | null = null;

  if (!ordersView.ok) {
    ordersError = ordersView.error;
  } else {
    const listed = await listPharmacyOrders(pharmacyId, { limit: 80 });
    if (!listed.ok) {
      ordersError = listed.error;
    } else {
      orders = listed.orders;
    }
  }

  const pharmacyCustomers: SaCustomerRow[] = customersResult.ok
    ? customersResult.customers
    : [];
  const pharmacyCustomersError = customersResult.ok
    ? null
    : customersResult.error;

  const actorProfileId = profileResult.profile?.id ?? '';
  const usersCapabilities = buildPharmacyUsersCapabilities({
    actor: { kind: 'platform', profileId: actorProfileId },
    roles,
  });
  const saTotal = actorProfileId
    ? await hasPlatformSuperAdminRole(actorProfileId)
    : { ok: false };

  const isStagingEnv = isStagingQrEnvironment({
    appEnv: process.env.FF_APP_ENV,
    host: headers().get('x-forwarded-host') ?? headers().get('host'),
  });

  return (
    <PharmacyDetailClient
      initialTab={initialTab}
      isStagingEnv={isStagingEnv}
      pharmacy={pharmacy}
      plans={plans}
      launchSeats={launchSeats}
      launchSeatDetail={launchSeatDetail}
      launchSeatEvents={launchSeatEvents}
      canManageLaunchSeats={saTotal.ok}
      canGenerateMaterials={canGeneratePharmacyMaterials(saTotal.ok)}
      members={members}
      roles={roles}
      usersCapabilities={usersCapabilities}
      catalogProducts={catalog.ok ? catalog.products : []}
      catalogCategories={catalog.ok ? catalog.categories : []}
      catalogLoadError={catalog.ok ? null : catalog.error}
      catalogMode={catalogMode}
      hasMasterProjection={hasMasterProjection}
      kioskDevices={kiosk.ok ? kiosk.devices : []}
      kioskDevicesError={kiosk.ok ? null : kiosk.error}
      kioskCommercialUiState={kioskEnt.uiState}
      kioskEntitlement={kioskEnt.entitlement}
      kioskModuleUsable={kioskEnt.moduleUsable}
      assistantCommercialUiState={assistantEnt.uiState}
      assistantEntitlement={assistantEnt.entitlement}
      assistantUsageRequestCount={assistantUsage?.requestCount ?? 0}
      assistantUsagePeriodYm={assistantUsage?.periodYm ?? ''}
      homeEntrypoint={homeQr.ok ? homeQr.entrypoint : null}
      homeEntrypointError={homeQr.ok ? null : homeQr.error}
      orders={orders}
      ordersError={ordersError}
      pharmacyCustomers={pharmacyCustomers}
      pharmacyCustomersError={pharmacyCustomersError}
    />
  );
}
