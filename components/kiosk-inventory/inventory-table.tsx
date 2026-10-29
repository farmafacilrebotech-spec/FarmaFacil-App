import Link from 'next/link';

import type { KioskAssetSummary } from '@/lib/kiosk-inventory/types';
import { KIOSK_ASSET_STATUS_LABELS } from '@/lib/kiosk-inventory/types';
import { Badge } from '@/components/ui/badge';

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
            <th className="px-4 py-3 font-medium">Código</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Farmacia</th>
            <th className="px-4 py-3 font-medium">Serie conjunto</th>
            <th className="px-4 py-3 font-medium">Modelo</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-semibold text-foreground">
                {a.assetCode}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <Badge variant="secondary">
                    {KIOSK_ASSET_STATUS_LABELS[a.status]}
                  </Badge>
                  {a.needsIdentification && a.status !== 'pending_identification' ? (
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
                {a.equipmentSerial ?? '—'}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {a.model ?? '—'}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/inventario-kioskos/${a.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  Ficha
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
