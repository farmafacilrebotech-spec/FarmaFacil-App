import type { KioskInventoryCounts } from '@/lib/kiosk-inventory/types';
import { KIOSK_ASSET_STATUS_LABELS } from '@/lib/kiosk-inventory/types';

export function InventoryCounts({ counts }: { counts: KioskInventoryCounts }) {
  const items = [
    { key: 'total', label: 'Totales', value: counts.total },
    {
      key: 'pending',
      label: KIOSK_ASSET_STATUS_LABELS.pending_identification,
      value: counts.pendingIdentification,
    },
    { key: 'warehouse', label: KIOSK_ASSET_STATUS_LABELS.warehouse, value: counts.warehouse },
    { key: 'assigned', label: KIOSK_ASSET_STATUS_LABELS.assigned, value: counts.assigned },
    { key: 'repair', label: KIOSK_ASSET_STATUS_LABELS.repair, value: counts.repair },
    { key: 'retired', label: KIOSK_ASSET_STATUS_LABELS.retired, value: counts.retired },
    {
      key: 'needs',
      label: 'Sin serie conjunto',
      value: counts.needsSerial,
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {items.map((item) => (
        <div
          key={item.key}
          className="rounded-2xl border border-border bg-card px-4 py-3 shadow-soft"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
