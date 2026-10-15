import { listPharmacyKioskDevices } from '@/lib/kiosk/devices';
import { getPharmacyKioskEntitlement } from '@/lib/kiosk/entitlement';
import { KioskDevicesPanel } from '@/components/kiosk/kiosk-devices-panel';
import {
  getCurrentProfile,
  hasPlatformPermission,
} from '@/lib/auth/platform';

export const dynamic = 'force-dynamic';

export default async function PharmacyKioskDevicesPage({
  params,
}: {
  params: { pharmacyId: string };
}) {
  const pharmacyId = params.pharmacyId;
  const [result, entitlement, profileResult, entitlementsManage] =
    await Promise.all([
      listPharmacyKioskDevices(pharmacyId),
      getPharmacyKioskEntitlement(pharmacyId),
      getCurrentProfile(),
      hasPlatformPermission('platform.entitlements.manage'),
    ]);

  const showAdminControls =
    Boolean(profileResult.profile) && entitlementsManage.ok;

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Kiosko
        </p>
        <h1 className="text-2xl font-semibold text-foreground">Dispositivos</h1>
      </div>
      <KioskDevicesPanel
        pharmacyId={pharmacyId}
        devices={result.ok ? result.devices : []}
        loadError={result.ok ? null : result.error}
        commercialUiState={entitlement.uiState}
        entitlement={entitlement.entitlement}
        moduleUsable={entitlement.moduleUsable}
        showAdminControls={showAdminControls}
      />
    </div>
  );
}
