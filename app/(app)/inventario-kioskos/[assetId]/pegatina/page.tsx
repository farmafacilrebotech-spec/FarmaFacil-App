import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AssetSticker } from '@/components/kiosk-inventory/asset-sticker';
import {
  CANONICAL_PRODUCTION_APP_URL,
  getAppBaseUrl,
} from '@/lib/auth/app-url';
import { hasKioskInventoryRead } from '@/lib/kiosk-inventory/authz';
import { getKioskAssetDetail } from '@/lib/kiosk-inventory/queries';
import { kioskAssetStablePath } from '@/lib/kiosk-inventory/types';

export const dynamic = 'force-dynamic';

export default async function KioskAssetStickerPage({
  params,
}: {
  params: { assetId: string };
}) {
  if (!(await hasKioskInventoryRead())) {
    redirect('/access-denied');
  }

  const asset = await getKioskAssetDetail(params.assetId);
  if (!asset) notFound();

  const base =
    getAppBaseUrl()?.replace(/\/$/, '') || CANONICAL_PRODUCTION_APP_URL;
  const qrUrl = `${base}${kioskAssetStablePath(asset.assetCode)}`;

  return (
    <div className="mx-auto max-w-lg space-y-4 print:max-w-none">
      <div className="print:hidden">
        <Link
          href={`/inventario-kioskos/${asset.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Volver a la ficha
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          Pegatina {asset.assetCode}
        </h1>
      </div>
      <AssetSticker
        assetCode={asset.assetCode}
        qrUrl={qrUrl}
        equipmentSerial={asset.equipmentSerial}
      />
    </div>
  );
}
