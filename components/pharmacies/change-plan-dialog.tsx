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

/**
 * Con piloto abierto: cambia plan EN PRUEBA (sin suscripción).
 * Sin piloto: asignación comercial (contratación) — la plaza se gestiona aparte.
 */
export function ChangePlanDialog({
  open,
  onOpenChange,
  pharmacyId,
  currentPlan,
  plans,
  launchSeats,
  hasOpenTrial = false,
  openTrialSku = null,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacyId: string;
  currentPlan: PlanSummary | null;
  plans: PlanSummary[];
  launchSeats?: LaunchSeats;
  hasOpenTrial?: boolean;
  openTrialSku?: string | null;
  onSuccess: (plan: PlanSummary) => void;
}) {
  const [selectedKey, setSelectedKey] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  /** Contratación explícita (crea suscripción). Obligatorio sin piloto abierto. */
  const [contractAck, setContractAck] = React.useState(false);

  const options = React.useMemo(() => buildChangePlanOptions(plans), [plans]);
  const commercial = React.useMemo(
    () =>
      options.filter((o) => {
        if (o.kind !== 'commercial' || !o.assignable) return false;
        if (hasOpenTrial) {
          const sku = normalizeCommercialPlanKey(o.assignKey);
          return (
            sku === 'general' ||
            sku === 'personalizado' ||
            sku === 'asistente_ia_personalizado'
          );
        }
        return true;
      }),
    [options, hasOpenTrial]
  );
  const legacy = React.useMemo(
    () =>
      hasOpenTrial
        ? []
        : options.filter(
            (o) => (o.kind === 'legacy' || o.kind === 'other') && o.assignable
          ),
    [options, hasOpenTrial]
  );
  const selected = options.find((o) => o.assignKey === selectedKey) ?? null;
  const selectedIsCommercial = Boolean(
    selected && normalizeCommercialPlanKey(selected.assignKey)
  );

  React.useEffect(() => {
    if (open) {
      setSelectedKey('');
      setError(null);
      setSubmitting(false);
      setConfirmOpen(false);
      setContractAck(false);
    }
  }, [open]);

  async function handleConfirm() {
    if (!selectedKey || submitting || !selected?.assignable) return;
    if (!hasOpenTrial && selectedIsCommercial && !contractAck) {
      setError(
        'Debes confirmar expresamente la contratación antes de asignar el plan de pago.'
      );
      setConfirmOpen(false);
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const result = await changePharmacyPlanAction(pharmacyId, selectedKey, {
        useLaunchPromo: false,
        reason: hasOpenTrial
          ? 'sa_change_trial_plan_dialog'
          : 'sa_change_plan_dialog',
        confirmContract: hasOpenTrial
          ? false
          : selectedIsCommercial
            ? true
            : undefined,
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
  const currentLabel = hasOpenTrial
    ? openTrialSku
      ? `En prueba · ${commercialPlanLabel(openTrialSku)}`
      : 'Piloto abierto'
    : currentPlan
      ? commercialPlanLabel(currentPlan.key) || currentPlan.name
      : '—';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90vh,760px)] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {hasOpenTrial ? 'Cambiar plan en prueba' : 'Cambiar plan'}
            </DialogTitle>
            <DialogDescription>
              {hasOpenTrial
                ? 'Actualiza el plan del piloto sin crear suscripción de pago, sin reservar plaza y sin reiniciar el contador.'
                : 'Asignación comercial. La reserva de plaza de lanzamiento se gestiona aparte.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {hasOpenTrial ? 'Plan en prueba: ' : 'Plan actual: '}
              </span>
              <span className="font-medium text-foreground">{currentLabel}</span>
              {currentIsLegacy && !hasOpenTrial ? (
                <span className="ml-2 text-xs text-amber-700">
                  (legacy interno)
                </span>
              ) : null}
            </div>

            {launchSeats && !hasOpenTrial ? (
              <p className="text-xs text-muted-foreground">
                Plazas lanzamiento 2027: {launchSeats.remaining} libres de{' '}
                {launchSeats.maxSlots}. La reserva es independiente de este
                diálogo.
              </p>
            ) : null}

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {hasOpenTrial
                  ? 'Planes disponibles en prueba'
                  : 'Oferta comercial vigente'}
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
                    {!hasOpenTrial ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Tarifa normal {plan.listMonthlyLabel}/mes
                        {plan.annualListLabel
                          ? ` · anual lista ~${plan.annualListLabel}`
                          : null}
                      </p>
                    ) : null}
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
                  Planes legacy (solo kernel · no oferta comercial)
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
            <AlertDialogTitle>
              {hasOpenTrial
                ? 'Confirmar plan en prueba'
                : 'Confirmar cambio de plan'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  {hasOpenTrial ? 'Plan en prueba actual' : 'Plan actual'}:{' '}
                  <strong className="text-foreground">{currentLabel}</strong>
                </p>
                <p>
                  Nuevo:{' '}
                  <strong className="text-foreground">
                    {selected?.label ?? '—'}
                  </strong>
                </p>
                {hasOpenTrial ? (
                  <p>
                    No se crea suscripción de pago ni se reserva plaza de
                    lanzamiento.
                  </p>
                ) : selectedIsCommercial ? (
                  <>
                    <p>
                      Tarifa normal{' '}
                      <strong className="text-foreground">
                        {selected?.listMonthlyLabel}/mes
                      </strong>
                      . Esto crea la suscripción comercial. La plaza de
                      lanzamiento se reserva aparte.
                    </p>
                    <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left text-foreground">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={contractAck}
                        disabled={submitting}
                        onChange={(e) => setContractAck(e.target.checked)}
                      />
                      <span>
                        Confirmo la <strong>contratación</strong> de este plan
                        (no es un cambio de plan en prueba).
                      </span>
                    </label>
                  </>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                submitting ||
                (!hasOpenTrial && selectedIsCommercial && !contractAck)
              }
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Aplicando…
                </>
              ) : hasOpenTrial ? (
                'Confirmar'
              ) : selectedIsCommercial ? (
                'Contratar plan'
              ) : (
                'Confirmar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
