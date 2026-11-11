'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { InventoryCounts } from '@/components/kiosk-inventory/inventory-counts';
import { InventoryTable } from '@/components/kiosk-inventory/inventory-table';
import { ReceiveBatchForm } from '@/components/kiosk-inventory/receive-batch-form';
import { AdminWideDialog } from '@/components/shared/admin-wide-dialog';
import type {
  KioskAssetSummary,
  KioskInventoryCounts,
} from '@/lib/kiosk-inventory/types';
import { INVENTORY_UI_STATUS_LABELS } from '@/lib/kiosk-inventory/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type StatusFilterKey =
  | 'all'
  | 'ordered'
  | 'received'
  | 'assigned'
  | 'exhibition'
  | 'repair'
  | 'retired'
  | 'needs_serial';

export function InventoryWorkspace({
  counts,
  assets,
  canWrite,
  initialQ,
  initialVendor,
  initialStatus,
}: {
  counts: KioskInventoryCounts | null;
  assets: KioskAssetSummary[];
  canWrite: boolean;
  initialQ: string;
  initialVendor: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [receiveOpen, setReceiveOpen] = React.useState(false);

  const filters: { key: StatusFilterKey; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'ordered', label: INVENTORY_UI_STATUS_LABELS.ordered },
    { key: 'received', label: INVENTORY_UI_STATUS_LABELS.received },
    { key: 'assigned', label: INVENTORY_UI_STATUS_LABELS.assigned },
    { key: 'exhibition', label: INVENTORY_UI_STATUS_LABELS.exhibition },
    { key: 'repair', label: INVENTORY_UI_STATUS_LABELS.repair },
    { key: 'retired', label: INVENTORY_UI_STATUS_LABELS.retired },
    { key: 'needs_serial', label: 'Sin serie (identificar)' },
  ];

  function filterHref(key: string) {
    const params = new URLSearchParams();
    if (key !== 'all') params.set('status', key);
    if (initialQ) params.set('q', initialQ);
    if (initialVendor) params.set('vendor', initialVendor);
    const qs = params.toString();
    return qs ? `/inventario-kioskos?${qs}` : '/inventario-kioskos';
  }

  function openAsset(asset: KioskAssetSummary) {
    if (asset.isPendingSlot) {
      router.push(
        asset.purchaseOrderId
          ? `/proveedores?tab=compras-kioskos`
          : '/proveedores?tab=compras-kioskos'
      );
      return;
    }
    router.push(`/inventario-kioskos/${asset.id}`);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Inventario de kioskos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unidades previstas (Pedido) y activos físicos con código KSK.
            «Sin serie» es una condición de identificación, no un pedido
            pendiente.
          </p>
          <p className="mt-2 text-sm">
            Compras:{' '}
            <Link
              href="/proveedores?tab=compras-kioskos"
              className="text-primary underline-offset-2 hover:underline"
            >
              Proveedores · kioskos
            </Link>
            .
          </p>
        </div>
        {canWrite ? (
          <Button type="button" onClick={() => setReceiveOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Alta nueva
          </Button>
        ) : null}
      </header>

      {counts ? <InventoryCounts counts={counts} /> : null}
      {counts && counts.needsSerial > 0 ? (
        <p className="text-xs text-amber-800">
          {counts.needsSerial} activo(s) recibido(s) sin número de serie del
          conjunto (pendiente de identificar). No se han convertido
          automáticamente de estado.
        </p>
      ) : null}

      <form className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label
            htmlFor="inv-q"
            className="text-xs font-medium text-muted-foreground"
          >
            Buscar
          </label>
          <Input
            id="inv-q"
            name="q"
            defaultValue={initialQ}
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
            defaultValue={initialVendor}
            placeholder="Filtrar proveedor…"
          />
        </div>
        {initialStatus && initialStatus !== 'all' ? (
          <input type="hidden" name="status" value={initialStatus} />
        ) : null}
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active =
            (initialStatus || 'all') === f.key ||
            (!initialStatus && f.key === 'all');
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

      <InventoryTable
        assets={assets}
        onOpen={openAsset}
        scrollable
      />

      <AdminWideDialog
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        title="Alta / recepción de kioskos"
        description="Crea activos físicos con código KSK permanente. Puedes vincular un n.º de pedido. No duplica unidades ya recibidas de un pedido operativo."
        size="xl"
      >
        <ReceiveBatchForm
          embedded
          onCompleted={() => {
            setReceiveOpen(false);
            router.refresh();
          }}
        />
      </AdminWideDialog>
    </div>
  );
}
