import type { InventoryUiStatus } from '@/lib/kiosk-inventory/types';
import {
  INVENTORY_UI_STATUS_COLORS,
  INVENTORY_UI_STATUS_LABELS,
} from '@/lib/kiosk-inventory/types';

export function InventoryStatusBadge({
  uiStatus,
  className,
}: {
  uiStatus: InventoryUiStatus;
  className?: string;
}) {
  const colors = INVENTORY_UI_STATUS_COLORS[uiStatus];
  return (
    <span
      className={
        className ??
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold'
      }
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.text,
      }}
    >
      {INVENTORY_UI_STATUS_LABELS[uiStatus]}
    </span>
  );
}
