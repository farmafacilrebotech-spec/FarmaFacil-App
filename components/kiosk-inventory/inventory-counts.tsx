import type { KioskInventoryCounts } from '@/lib/kiosk-inventory/types';
import {
  INVENTORY_UI_STATUS_COLORS,
  INVENTORY_UI_STATUS_LABELS,
  INVENTORY_UI_STATUS_ORDER,
} from '@/lib/kiosk-inventory/types';

export function InventoryCounts({ counts }: { counts: KioskInventoryCounts }) {
  const valueByUi = {
    ordered: counts.ordered,
    assigned: counts.assigned,
    exhibition: counts.exhibition,
    received: counts.received,
    repair: counts.repair,
    retired: counts.retired,
  } as const;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {INVENTORY_UI_STATUS_ORDER.map((ui) => {
        const colors = INVENTORY_UI_STATUS_COLORS[ui];
        return (
          <div
            key={ui}
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
              {INVENTORY_UI_STATUS_LABELS[ui]}
            </p>
            <p
              className="mt-1 text-2xl font-semibold"
              style={{ color: colors.text }}
            >
              {valueByUi[ui]}
            </p>
          </div>
        );
      })}
    </div>
  );
}
