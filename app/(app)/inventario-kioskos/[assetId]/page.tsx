import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AssetDetailPanels } from '@/components/kiosk-inventory/asset-detail-panels';
import {
  hasKioskInventoryRead,
  hasKioskInventoryWrite,
} from '@/lib/kiosk-inventory/authz';
import { getKioskAssetDetail } from '@/lib/kiosk-inventory/queries';
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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link
          href="/inventario-kioskos"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Volver al inventario
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          {asset.assetCode}
        </h1>
        <p className="text-sm text-muted-foreground">
          Historial de asignaciones y seguros. El código no cambia al
          desvincular o reasignar.
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
