'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import type { PlanSummary } from '@/lib/pharmacies/types';
import {
  buildChangePlanOptions,
  commercialPlanLabel,
  isLegacyKernelPlanKey,
} from '@/lib/pharmacies/commercial-plan-catalog';
import { changePharmacyPlanAction } from '@/app/(app)/farmacias/actions';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  const [selectedKey, setSelectedKey] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const options = React.useMemo(() => buildChangePlanOptions(plans), [plans]);
  const selectable = React.useMemo(
    () =>
      options.filter(
        (o) =>
          o.assignable &&
          o.assignKey.toLowerCase() !== (currentPlan?.key ?? '').toLowerCase()
      ),
    [options, currentPlan?.key]
  );
  const selected = options.find((o) => o.assignKey === selectedKey) ?? null;

  React.useEffect(() => {
    if (open) {
      setSelectedKey('');
      setError(null);
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (!selectedKey || submitting || !selected?.assignable) return;
    setError(null);
    setSubmitting(true);

    try {
      const result = await changePharmacyPlanAction(pharmacyId, selectedKey);
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        setConfirmOpen(false);
        return;
      }

      const nextPlan =
        plans.find((p) => p.key === selectedKey) ??
        ({
          id: selected.planId ?? '',
          key: selectedKey,
          name: selected.label,
          description: selected.description,
          is_active: true,
          sort_order: 0,
        } satisfies PlanSummary);

      onSuccess(nextPlan);
      setConfirmOpen(false);
      onOpenChange(false);
    } catch {
      setError('No se ha podido cambiar el plan. Inténtalo de nuevo.');
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  const commercial = options.filter((o) => o.kind === 'commercial');
  const legacy = options.filter((o) => o.kind === 'legacy' || o.kind === 'other');
  const currentIsLegacy = isLegacyKernelPlanKey(currentPlan?.key);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90vh,760px)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Cambiar plan</DialogTitle>
            <DialogDescription>
              Planes comerciales vigentes: General, Personalizado e IA. El
              cambio exige confirmación y no crea suscripciones nuevas ni migra
              datos automáticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Plan actual: </span>
              <span className="font-medium text-foreground">
                {currentPlan
                  ? commercialPlanLabel(currentPlan.key) || currentPlan.name
                  : '—'}
              </span>
              {currentIsLegacy ? (
                <span className="ml-2 text-xs text-amber-700">
                  (legacy interno)
                </span>
              ) : null}
            </div>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Oferta comercial vigente
              </h3>
              <div className="grid gap-2 sm:grid-cols-1">
                {commercial.map((plan) => (
                  <button
                    key={`c-${plan.assignKey}`}
                    type="button"
                    disabled={submitting || !plan.assignable}
                    onClick={() => setSelectedKey(plan.assignKey)}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-colors',
                      selectedKey === plan.assignKey
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/40',
                      !plan.assignable && 'cursor-not-allowed opacity-60'
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {plan.label}
                      {!plan.assignable ? (
                        <span className="ml-2 text-xs font-normal text-amber-700">
                          no asignable aún
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan.description}
                    </p>
                  </button>
                ))}
              </div>
            </section>

            {legacy.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Planes legacy / otros en catálogo técnico
                </h3>
                <div className="grid gap-2">
                  {legacy.map((plan) => (
                    <button
                      key={`l-${plan.assignKey}`}
                      type="button"
                      disabled={submitting || !plan.assignable}
                      onClick={() => setSelectedKey(plan.assignKey)}
                      className={cn(
                        'rounded-xl border border-dashed p-3 text-left transition-colors',
                        selectedKey === plan.assignKey
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/40'
                      )}
                    >
                      <p className="text-sm font-semibold text-foreground">
                        {plan.label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {plan.description}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {selectable.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                No hay otros planes asignables en el catálogo técnico actual.
                Los planes comerciales vigentes se muestran arriba; si aparecen
                como «no asignable», falta la fila técnica correspondiente
                (borrador 056 / catálogo `plans`).
              </p>
            ) : null}

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
              disabled={!selected?.assignable || submitting}
              onClick={() => setConfirmOpen(true)}
              className="gap-1.5"
            >
              Continuar…
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio de plan</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Plan actual:{' '}
                  <strong className="text-foreground">
                    {currentPlan
                      ? commercialPlanLabel(currentPlan.key) || currentPlan.name
                      : '—'}
                  </strong>
                </p>
                <p>
                  Nuevo plan:{' '}
                  <strong className="text-foreground">
                    {selected?.label ?? '—'}
                  </strong>
                </p>
                <p>
                  Consecuencias: el cambio se aplica de inmediato sobre la
                  suscripción técnica. No migra catálogo ni crea altas
                  comerciales nuevas automáticamente. Los datos de la farmacia
                  se conservan.
                </p>
                {selected?.kind === 'legacy' ? (
                  <p className="text-amber-800">
                    Estás asignando un plan legacy interno, no la oferta
                    comercial vigente (General / Personalizado / IA).
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
            >
              {submitting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Confirmar cambio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
