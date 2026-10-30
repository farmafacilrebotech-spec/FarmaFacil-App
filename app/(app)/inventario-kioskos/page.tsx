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
import type { KioskAssetStatus } from '@/lib/kiosk-inventory/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const dynamic = 'force-dynamic';

export default async function KioskInventoryPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string };
}) {
  if (!(await hasKioskInventoryRead())) {
    redirect('/access-denied');
  }

  const statusParam = searchParams?.status;
  const status: KioskAssetStatus | 'all' | 'needs_serial' =
    statusParam === 'pending_identification' ||
    statusParam === 'warehouse' ||
    statusParam === 'assigned' ||
    statusParam === 'repair' ||
    statusParam === 'retired' ||
    statusParam === 'needs_serial'
      ? statusParam
      : 'all';
  const q = searchParams?.q ?? '';

  const [counts, assets, canWrite] = await Promise.all([
    getKioskInventoryCounts(),
    listKioskAssets({ query: q, status }),
    hasKioskInventoryWrite(),
  ]);

  const filters: { key: string; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'pending_identification', label: 'Pend. identificar' },
    { key: 'needs_serial', label: 'Sin serie conjunto' },
    { key: 'warehouse', label: 'Almacén' },
    { key: 'assigned', label: 'Asignados' },
    { key: 'repair', label: 'Reparación' },
    { key: 'retired', label: 'Retirados' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">
          Inventario de kioskos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Activos físicos con identificador permanente (KSK-…). Independiente
          del emparejamiento runtime y del aprovisionamiento previsto del
          simulador comercial.
        </p>
        <p className="mt-2 text-xs text-amber-800">
          El simulador en Tarifas usa hipótesis de inventario inicial / lote /
          plazo: no crea ni modifica estos activos.
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
            placeholder="Código, serie, farmacia, póliza…"
          />
        </div>
        {statusParam ? (
          <input type="hidden" name="status" value={statusParam} />
        ) : null}
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const href =
            f.key === 'all'
              ? q
                ? `/inventario-kioskos?q=${encodeURIComponent(q)}`
                : '/inventario-kioskos'
              : `/inventario-kioskos?status=${f.key}${
                  q ? `&q=${encodeURIComponent(q)}` : ''
                }`;
          const active = (statusParam ?? 'all') === f.key || (!statusParam && f.key === 'all');
          return (
            <Button
              key={f.key}
              asChild
              size="sm"
              variant={active ? 'default' : 'outline'}
            >
              <Link href={href}>{f.label}</Link>
            </Button>
          );
        })}
      </div>

      <InventoryTable assets={assets} />

      {canWrite ? <ReceiveBatchForm /> : null}
    </div>
  );
}
