import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AssetDetailPanels } from '@/components/kiosk-inventory/asset-detail-panels';
import { InventoryStatusBadge } from '@/components/kiosk-inventory/inventory-status-badge';
import {
  hasKioskInventoryRead,
  hasKioskInventoryWrite,
} from '@/lib/kiosk-inventory/authz';
import { getKioskAssetDetail } from '@/lib/kiosk-inventory/queries';
import {
  INVENTORY_UI_STATUS_LABELS,
  assetStatusToUi,
} from '@/lib/kiosk-inventory/types';
import { listPharmacies } from '@/lib/pharmacies/queries';

export const dynamic = 'force-dynamic';

export default async function KioskAssetDetailPage({
  params,
}: {
  params: { assetId: string };
}) {
  if (!(await hasKioskInventoryRead())) {
    redirect('/access-denied');
  }

  const asset = await getKioskAssetDetail(params.assetId);
  if (!asset) notFound();

  const canWrite = await hasKioskInventoryWrite();
  let pharmacies: { id: string; name: string }[] = [];
  try {
    const rows = await listPharmacies();
    pharmacies = rows.map((p) => ({ id: p.id, name: p.name }));
  } catch (err) {
    console.error('[kiosk-inventory] pharmacies', err);
  }

  const uiStatus = asset.uiStatus ?? assetStatusToUi(asset.status);
  const statusLabel = INVENTORY_UI_STATUS_LABELS[uiStatus] ?? asset.status;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          href="/inventario-kioskos"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Volver al inventario
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">
            {asset.assetCode}
          </h1>
          <InventoryStatusBadge uiStatus={uiStatus} />
          <span className="text-sm font-medium text-foreground">
            {statusLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Ubicación: {asset.locationLabel ?? '—'}
          {asset.needsIdentification
            ? ' · Sin serie (indicador secundario)'
            : ''}
        </p>
      </div>
      <AssetDetailPanels
        asset={asset}
        pharmacies={pharmacies}
        canWrite={canWrite}
      />
    </div>
  );
}
