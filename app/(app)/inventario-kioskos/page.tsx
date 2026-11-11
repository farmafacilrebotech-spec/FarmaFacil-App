import { redirect } from 'next/navigation';

import { InventoryWorkspace } from '@/components/kiosk-inventory/inventory-workspace';
import {
  hasKioskInventoryRead,
  hasKioskInventoryWrite,
} from '@/lib/kiosk-inventory/authz';
import {
  getKioskInventoryCounts,
  listKioskAssets,
} from '@/lib/kiosk-inventory/queries';
import type { InventoryUiStatus, KioskAssetStatus } from '@/lib/kiosk-inventory/types';

export const dynamic = 'force-dynamic';

type StatusFilter =
  | KioskAssetStatus
  | InventoryUiStatus
  | 'all'
  | 'needs_serial'
  | 'ordered'
  | 'received';

function parseStatus(raw: string | undefined): StatusFilter {
  if (
    raw === 'ordered' ||
    raw === 'received' ||
    raw === 'assigned' ||
    raw === 'exhibition' ||
    raw === 'repair' ||
    raw === 'retired' ||
    raw === 'needs_serial' ||
    raw === 'warehouse' ||
    raw === 'pending_identification'
  ) {
    return raw;
  }
  return 'all';
}

export default async function KioskInventoryPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; vendor?: string };
}) {
  if (!(await hasKioskInventoryRead())) {
    redirect('/access-denied');
  }

  const status = parseStatus(searchParams?.status);
  const q = searchParams?.q ?? '';
  const vendor = searchParams?.vendor ?? '';

  const [counts, assets, canWrite] = await Promise.all([
    getKioskInventoryCounts(),
    listKioskAssets({ query: q, status, vendor }),
    hasKioskInventoryWrite(),
  ]);

  return (
    <div className="mx-auto max-w-6xl">
      <InventoryWorkspace
        counts={counts}
        assets={assets}
        canWrite={canWrite}
        initialQ={q}
        initialVendor={vendor}
        initialStatus={searchParams?.status ?? 'all'}
      />
    </div>
  );
}
