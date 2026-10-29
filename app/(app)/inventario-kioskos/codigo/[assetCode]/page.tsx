import { notFound, redirect } from 'next/navigation';

import { hasKioskInventoryRead } from '@/lib/kiosk-inventory/authz';
import { getKioskAssetDetailByCode } from '@/lib/kiosk-inventory/queries';

export const dynamic = 'force-dynamic';

/**
 * Destino estable del QR de pegatina (por código KSK, no por farmacia).
 * Exige sesión + platform.kiosk_inventory.read — no es público.
 */
export default async function KioskAssetByCodePage({
  params,
}: {
  params: { assetCode: string };
}) {
  if (!(await hasKioskInventoryRead())) {
    redirect('/access-denied');
  }

  const asset = await getKioskAssetDetailByCode(
    decodeURIComponent(params.assetCode)
  );
  if (!asset) notFound();

  redirect(`/inventario-kioskos/${asset.id}`);
}
