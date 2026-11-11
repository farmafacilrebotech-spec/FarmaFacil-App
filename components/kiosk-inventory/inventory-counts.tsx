import type { KioskInventoryCounts } from '@/lib/kiosk-inventory/types';
import {
  INVENTORY_UI_STATUS_COLORS,
  INVENTORY_UI_STATUS_LABELS,
} from '@/lib/kiosk-inventory/types';

export function InventoryCounts({ counts }: { counts: KioskInventoryCounts }) {
  const items = [
    {
      key: 'ordered',
      label: 'Pendientes de recibir',
      value: counts.ordered,
      ui: 'ordered' as const,
    },
    {
      key: 'received',
      label: 'Recibidos disponibles',
      value: counts.received,
      ui: 'received' as const,
    },
    {
      key: 'assigned',
      label: INVENTORY_UI_STATUS_LABELS.assigned,
      value: counts.assigned,
      ui: 'assigned' as const,
    },
    {
      key: 'exhibition',
      label: INVENTORY_UI_STATUS_LABELS.exhibition,
      value: counts.exhibition,
      ui: 'exhibition' as const,
    },
    {
      key: 'repair',
      label: INVENTORY_UI_STATUS_LABELS.repair,
      value: counts.repair,
      ui: 'repair' as const,
    },
    {
      key: 'retired',
      label: INVENTORY_UI_STATUS_LABELS.retired,
      value: counts.retired,
      ui: 'retired' as const,
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => {
        const colors = INVENTORY_UI_STATUS_COLORS[item.ui];
        return (
          <div
            key={item.key}
            className="rounded-2xl border px-4 py-3 shadow-soft"
            style={{
              backgroundColor: colors.bg,
              borderColor: colors.border,
            }}
          >
            <p
              className="text-[10px] font-medium uppercase tracking-wide"
              style={{ color: colors.text }}
            >
              {item.label}
            </p>
            <p
              className="mt-1 text-2xl font-semibold"
              style={{ color: colors.text }}
            >
              {item.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
