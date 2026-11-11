import Link from 'next/link';
import { redirect } from 'next/navigation';

import { InventoryCounts } from '@/components/kiosk-inventory/inventory-counts';
import { InventoryTable } from '@/components/kiosk-inventory/inventory-table';
import { ReceiveBatchForm } from '@/components/kiosk-inventory/receive-batch-form';
import {
  hasKioskInventoryRead,
  hasKioskInventoryWrite,
} from '@/lib/kiosk-inventory/authz';
import {
  getKioskInventoryCounts,
  listKioskAssets,
} from '@/lib/kiosk-inventory/queries';
import type { InventoryUiStatus, KioskAssetStatus } from '@/lib/kiosk-inventory/types';
import { INVENTORY_UI_STATUS_LABELS } from '@/lib/kiosk-inventory/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

  const filters: { key: string; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'ordered', label: INVENTORY_UI_STATUS_LABELS.ordered },
    { key: 'received', label: INVENTORY_UI_STATUS_LABELS.received },
    { key: 'assigned', label: INVENTORY_UI_STATUS_LABELS.assigned },
    { key: 'exhibition', label: INVENTORY_UI_STATUS_LABELS.exhibition },
    { key: 'repair', label: INVENTORY_UI_STATUS_LABELS.repair },
    { key: 'retired', label: INVENTORY_UI_STATUS_LABELS.retired },
    { key: 'needs_serial', label: 'Sin serie' },
  ];

  function filterHref(key: string) {
    const params = new URLSearchParams();
    if (key !== 'all') params.set('status', key);
    if (q) params.set('q', q);
    if (vendor) params.set('vendor', vendor);
    const qs = params.toString();
    return qs ? `/inventario-kioskos?${qs}` : '/inventario-kioskos';
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">
          Inventario de kioskos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Unidades previstas (pedido) y activos físicos con código KSK. Las
          unidades blancas no tienen KSK hasta la recepción.
        </p>
        <p className="mt-2 text-sm">
          Compras y presupuestos de proveedor:{' '}
          <Link
            href="/proveedores"
            className="text-primary underline-offset-2 hover:underline"
          >
            Proveedores
          </Link>
          .
        </p>
      </header>

      {counts ? <InventoryCounts counts={counts} /> : null}

      <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label htmlFor="inv-q" className="text-xs font-medium text-muted-foreground">
            Buscar
          </label>
          <Input
            id="inv-q"
            name="q"
            defaultValue={q}
            placeholder="Código, serie, farmacia, pedido…"
          />
        </div>
        <div className="w-full space-y-1.5 sm:w-56">
          <label
            htmlFor="inv-vendor"
            className="text-xs font-medium text-muted-foreground"
          >
            Proveedor
          </label>
          <Input
            id="inv-vendor"
            name="vendor"
            defaultValue={vendor}
            placeholder="Filtrar proveedor…"
          />
        </div>
        {status !== 'all' ? (
          <input type="hidden" name="status" value={status} />
        ) : null}
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active =
            (searchParams?.status ?? 'all') === f.key ||
            (!searchParams?.status && f.key === 'all');
          return (
            <Button
              key={f.key}
              asChild
              size="sm"
              variant={active ? 'default' : 'outline'}
            >
              <Link href={filterHref(f.key)}>{f.label}</Link>
            </Button>
          );
        })}
      </div>

      <InventoryTable assets={assets} />

      {canWrite ? <ReceiveBatchForm /> : null}
    </div>
  );
}
