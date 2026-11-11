'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import type { PlanSummary } from '@/lib/pharmacies/types';
import {
  buildChangePlanOptions,
  commercialPlanLabel,
  isLegacyKernelPlanKey,
  normalizeCommercialPlanKey,
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

type LaunchSeats = {
  maxSlots: number;
  usedSlots: number;
  remaining: number;
  pharmacyHasActiveSeat: boolean;
};

export function ChangePlanDialog({
  open,
  onOpenChange,
  pharmacyId,
  currentPlan,
  plans,
  launchSeats,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacyId: string;
  currentPlan: PlanSummary | null;
  plans: PlanSummary[];
  launchSeats?: LaunchSeats;
  onSuccess: (plan: PlanSummary) => void;
}) {
  const [selectedKey, setSelectedKey] = React.useState('');
  const [useLaunchPromo, setUseLaunchPromo] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const options = React.useMemo(() => buildChangePlanOptions(plans), [plans]);
  const commercial = React.useMemo(
    () => options.filter((o) => o.kind === 'commercial' && o.assignable),
    [options]
  );
  const legacy = React.useMemo(
    () =>
      options.filter(
        (o) => (o.kind === 'legacy' || o.kind === 'other') && o.assignable
      ),
    [options]
  );
  const selected = options.find((o) => o.assignKey === selectedKey) ?? null;
  const selectedIsCommercial = Boolean(
    selected && normalizeCommercialPlanKey(selected.assignKey)
  );
  const slotsRemaining = launchSeats?.remaining ?? 0;
  const canOfferLaunch =
    selectedIsCommercial &&
    (slotsRemaining > 0 || Boolean(launchSeats?.pharmacyHasActiveSeat));

  React.useEffect(() => {
    if (open) {
      setSelectedKey('');
      setUseLaunchPromo(false);
      setError(null);
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!canOfferLaunch) setUseLaunchPromo(false);
  }, [canOfferLaunch, selectedKey]);

  async function handleConfirm() {
    if (!selectedKey || submitting || !selected?.assignable) return;
    setError(null);
    setSubmitting(true);

    try {
      const result = await changePharmacyPlanAction(pharmacyId, selectedKey, {
        useLaunchPromo: selectedIsCommercial && useLaunchPromo,
        reason: 'sa_change_plan_dialog',
      });
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
      setError(
        'No se ha podido cambiar el plan. No se ha aplicado ningún cambio parcial.'
      );
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  const currentIsLegacy = isLegacyKernelPlanKey(currentPlan?.key);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90vh,760px)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Cambiar plan</DialogTitle>
            <DialogDescription>
              Solo se listan planes realmente asignables. Los comerciales
              (General / Personalizado / IA) usan el flujo atómico de
              asignación; no pasan por el procedimiento legacy.
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

            {launchSeats ? (
              <p className="text-xs text-muted-foreground">
                Plazas lanzamiento 2027: {launchSeats.remaining} libres de{' '}
                {launchSeats.maxSlots}
                {launchSeats.pharmacyHasActiveSeat
                  ? ' · esta farmacia ya tiene plaza promocional'
                  : null}
                . La promo (−60 % → 39 / 69 / 99 €) es independiente del plan
                contratado. Prepago anual: −15 % adicional sobre la cuota
                mensual aplicable.
              </p>
            ) : null}

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Oferta comercial vigente
              </h3>
              <div className="grid gap-2">
                {commercial.map((plan) => (
                  <button
                    key={`c-${plan.assignKey}`}
                    type="button"
                    disabled={submitting}
                    onClick={() => setSelectedKey(plan.assignKey)}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-colors',
                      selectedKey === plan.assignKey
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {plan.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tarifa normal {plan.listMonthlyLabel}/mes
                      {plan.promoMonthlyLabel
                        ? ` · promo lanzamiento ${plan.promoMonthlyLabel}/mes`
                        : null}
                      {plan.annualListLabel
                        ? ` · anual lista ~${plan.annualListLabel}`
                        : null}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan.description}
                    </p>
                  </button>
                ))}
                {commercial.length === 0 ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    No hay planes comerciales asignables (faltan filas técnicas
                    en `plans`).
                  </p>
                ) : null}
              </div>
            </section>

            {selectedIsCommercial && canOfferLaunch ? (
              <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={useLaunchPromo}
                  disabled={submitting}
                  onChange={(e) => setUseLaunchPromo(e.target.checked)}
                />
                <span>
                  Aplicar promoción lanzamiento 2027 (
                  {selected?.promoMonthlyLabel}/mes) y reservar plaza. Si no se
                  marca, se asigna a tarifa normal ({selected?.listMonthlyLabel}
                  /mes).
                </span>
              </label>
            ) : null}

            {legacy.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Planes legacy (solo kernel)
                </h3>
                <div className="grid gap-2">
                  {legacy.map((plan) => (
                    <button
                      key={`l-${plan.assignKey}`}
                      type="button"
                      disabled={submitting}
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
                {selectedIsCommercial ? (
                  <p>
                    Tarifa:{' '}
                    <strong className="text-foreground">
                      {useLaunchPromo
                        ? `promo lanzamiento ${selected?.promoMonthlyLabel}/mes`
                        : `normal ${selected?.listMonthlyLabel}/mes`}
                    </strong>
                    . El plan contratado y la tarifa promocional son conceptos
                    distintos.
                  </p>
                ) : null}
                <p>
                  La operación es atómica: si falla, no se aplican cambios
                  parciales de plan, catálogo ni plaza.
                </p>
                {selected?.kind === 'legacy' ? (
                  <p className="text-amber-800">
                    Estás asignando un plan legacy interno, no la oferta
                    comercial vigente.
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
