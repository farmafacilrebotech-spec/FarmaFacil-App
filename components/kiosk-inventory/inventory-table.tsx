import Link from 'next/link';

import { InventoryStatusBadge } from '@/components/kiosk-inventory/inventory-status-badge';
import type { KioskAssetSummary } from '@/lib/kiosk-inventory/types';

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('es-ES');
  } catch {
    return value;
  }
}

export function InventoryTable({ assets }: { assets: KioskAssetSummary[] }) {
  if (assets.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        No hay kioskos que coincidan con los filtros.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Código KSK</th>
            <th className="px-4 py-3 font-medium">Pedido</th>
            <th className="px-4 py-3 font-medium">Proveedor</th>
            <th className="px-4 py-3 font-medium">Modelo</th>
            <th className="px-4 py-3 font-medium">Serie</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Farmacia</th>
            <th className="px-4 py-3 font-medium">Ubicación</th>
            <th className="px-4 py-3 font-medium">Recepción</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr
              key={a.id}
              className="border-b border-border last:border-0"
              style={
                a.uiStatus === 'ordered'
                  ? { backgroundColor: '#FFFFFF' }
                  : undefined
              }
            >
              <td className="px-4 py-3 font-semibold text-foreground">
                {a.isPendingSlot ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  a.assetCode
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {a.purchaseOrderRef ?? '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {a.vendor ?? '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {a.model ?? '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {a.isPendingSlot
                  ? '—'
                  : a.equipmentSerial ?? (
                      <span className="text-amber-700">Pendiente</span>
                    )}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <InventoryStatusBadge uiStatus={a.uiStatus} />
                  {a.needsIdentification && !a.isPendingSlot ? (
                    <span className="text-[10px] text-amber-700">
                      Sin serie conjunto
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {a.currentPharmacyName ?? '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {a.locationLabel ?? '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDate(a.receivedAt)}
              </td>
              <td className="px-4 py-3 text-right">
                {a.isPendingSlot ? (
                  <Link
                    href="/proveedores"
                    className="font-medium text-primary hover:underline"
                  >
                    Pedido
                  </Link>
                ) : (
                  <Link
                    href={`/inventario-kioskos/${a.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    Ficha
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
