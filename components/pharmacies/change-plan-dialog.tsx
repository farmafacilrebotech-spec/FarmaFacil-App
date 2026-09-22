'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import type { PlanKey, PlanSummary } from '@/lib/pharmacies/types';
import { changePharmacyPlanAction } from '@/app/(app)/farmacias/actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ChangePlanDialog({
  open,
  onOpenChange,
  pharmacyId,
  currentPlan,
  plans,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacyId: string;
  currentPlan: PlanSummary | null;
  plans: PlanSummary[];
  onSuccess: (plan: PlanSummary) => void;
}) {
  const [selectedKey, setSelectedKey] = React.useState<PlanKey | ''>('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectablePlans = React.useMemo(
    () => plans.filter((p) => p.key !== currentPlan?.key),
    [plans, currentPlan?.key]
  );

  React.useEffect(() => {
    if (open) {
      setSelectedKey('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (!selectedKey || submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const result = await changePharmacyPlanAction(pharmacyId, selectedKey);
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      const nextPlan =
        plans.find((p) => p.key === selectedKey) ??
        ({
          id: '',
          key: selectedKey,
          name: selectedKey,
          description: null,
          is_active: true,
          sort_order: 0,
        } satisfies PlanSummary);

      onSuccess(nextPlan);
      onOpenChange(false);
    } catch {
      setError('No se ha podido cambiar el plan. Inténtalo de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cambiar plan</DialogTitle>
          <DialogDescription>
            Selecciona el nuevo plan comercial para esta farmacia. El cambio se
            aplica de forma inmediata.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Plan actual: </span>
            <span className="font-medium text-foreground">
              {currentPlan?.name ?? '—'}
            </span>
          </div>

          {selectablePlans.length === 0 ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              No hay otros planes activos disponibles.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {selectablePlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  disabled={submitting}
                  onClick={() => setSelectedKey(plan.key as PlanKey)}
                  className={cn(
                    'rounded-xl border p-3 text-left transition-colors',
                    selectedKey === plan.key
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">
                    {plan.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.description || plan.key}
                  </p>
                </button>
              ))}
            </div>
          )}

          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!selectedKey || submitting || selectablePlans.length === 0}
            onClick={() => void handleConfirm()}
            className="gap-1.5"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            {submitting ? 'Cambiando…' : 'Confirmar cambio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
