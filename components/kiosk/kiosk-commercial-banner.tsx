import { formatDateTime } from '@/lib/format';
import {
  kioskCommercialUiCopy,
  type KioskCommercialUiState,
  type KioskEntitlementRecord,
} from '@/lib/kiosk/entitlement-status';
import { cn } from '@/lib/utils';

const toneClass: Record<
  ReturnType<typeof kioskCommercialUiCopy>['tone'],
  string
> = {
  neutral: 'border-border bg-muted/40 text-foreground',
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
};

export function KioskCommercialBanner({
  uiState,
  entitlement,
}: {
  uiState: KioskCommercialUiState;
  entitlement: KioskEntitlementRecord | null;
}) {
  const copy = kioskCommercialUiCopy(uiState);
  const endsLabel =
    entitlement?.endsAt &&
    (uiState === 'trial_active' || uiState === 'trial_expired')
      ? formatDateTime(entitlement.endsAt)
      : null;

  return (
    <div
      role="status"
      className={cn(
        'rounded-xl border px-4 py-3 text-sm',
        toneClass[copy.tone]
      )}
    >
      <p className="font-semibold">{copy.title}</p>
      <p className="mt-1 opacity-90">{copy.description}</p>
      {endsLabel ? (
        <p className="mt-1 text-xs opacity-80">
          Vencimiento de la prueba: {endsLabel}
        </p>
      ) : null}
    </div>
  );
}
