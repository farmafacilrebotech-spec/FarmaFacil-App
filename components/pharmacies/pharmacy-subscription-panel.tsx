'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2 } from 'lucide-react';

import type { PharmacyDetail } from '@/lib/pharmacies/types';
import {
  PHARMACY_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from '@/lib/pharmacies/labels';
import { formatDate } from '@/lib/format';
import {
  COMMERCIAL_ACTION_LABELS,
  COMMERCIAL_ACTION_SUCCESS,
  commercialActionRequiresConfirm,
  listVisibleCommercialActions,
  snapshotFromPharmacyDetail,
  type CommercialAction,
} from '@/lib/pharmacies/commercial-lifecycle';
import { transitionPharmacySubscriptionAction } from '@/app/(app)/farmacias/actions';
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

function DateValue({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <span className="font-medium text-foreground">{formatDate(value)}</span>;
}

export function PharmacySubscriptionPanel({
  pharmacy,
}: {
  pharmacy: PharmacyDetail;
}) {
  const router = useRouter();
  const [pendingAction, setPendingAction] =
    React.useState<CommercialAction | null>(null);
  const [confirmAction, setConfirmAction] =
    React.useState<CommercialAction | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  const sub = pharmacy.subscription;
  const snapshot = snapshotFromPharmacyDetail({
    pharmacyStatus: pharmacy.status,
    subscriptionStatus: sub?.status ?? null,
    trialEnd: sub?.trial_end,
    currentPeriodEnd: sub?.current_period_end,
    cancelAtPeriodEnd: sub?.cancel_at_period_end,
    gracePeriodEndsAt: sub?.grace_period_ends_at,
  });

  const visibleActions = snapshot
    ? listVisibleCommercialActions(snapshot)
    : [];

  async function runAction(action: CommercialAction) {
    if (busy) return;
    setBusy(true);
    setPendingAction(action);
    try {
      const result = await transitionPharmacySubscriptionAction(
        pharmacy.id,
        action
      );
      if (!result.ok) {
        setFeedback({ tone: 'error', message: result.error });
        return;
      }
      setFeedback({
        tone: 'success',
        message: COMMERCIAL_ACTION_SUCCESS[action],
      });
      router.refresh();
    } catch {
      setFeedback({
        tone: 'error',
        message:
          'No se ha podido completar la operación comercial. Inténtalo de nuevo.',
      });
    } finally {
      setBusy(false);
      setPendingAction(null);
      setConfirmAction(null);
    }
  }

  function handleActionClick(action: CommercialAction) {
    if (commercialActionRequiresConfirm(action)) {
      setConfirmAction(action);
      return;
    }
    void runAction(action);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Suscripción comercial
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Gestión SuperAdmin · provider{' '}
              {sub?.provider ? (
                <span className="font-medium text-foreground">{sub.provider}</span>
              ) : (
                '—'
              )}
            </p>
          </div>
        </div>
      </div>

      {feedback ? (
        <div
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          className={
            feedback.tone === 'success'
              ? 'mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400'
              : 'mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'
          }
        >
          {feedback.message}
        </div>
      ) : null}

      {!sub ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Esta farmacia no tiene suscripción registrada.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Plan</dt>
              <dd className="text-sm font-medium text-foreground">
                {pharmacy.plan?.name ?? sub.plan?.name ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Estado suscripción</dt>
              <dd className="text-sm font-medium text-foreground">
                {SUBSCRIPTION_STATUS_LABELS[sub.status] ?? sub.status}
                {sub.cancel_at_period_end ? (
                  <span className="ml-1 text-xs font-normal text-amber-700 dark:text-amber-400">
                    (cancelación al fin de periodo)
                  </span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Estado farmacia</dt>
              <dd className="text-sm font-medium text-foreground">
                {PHARMACY_STATUS_LABELS[pharmacy.status] ?? pharmacy.status}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Fin de prueba</dt>
              <dd className="text-sm">
                <DateValue value={sub.trial_end} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Fin de periodo</dt>
              <dd className="text-sm">
                <DateValue value={sub.current_period_end} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Fin de gracia</dt>
              <dd className="text-sm">
                <DateValue value={sub.grace_period_ends_at} />
              </dd>
            </div>
          </dl>

          {(sub.commercial_reason || pharmacy.suspension_reason) && (
            <p className="mt-3 text-xs text-muted-foreground">
              Motivo:{' '}
              <span className="text-foreground">
                {pharmacy.suspension_reason || sub.commercial_reason}
              </span>
            </p>
          )}

          {visibleActions.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {visibleActions.map((action) => {
                const destructive =
                  action === 'cancel_now' ||
                  action === 'suspend_for_nonpayment';
                const isPending = busy && pendingAction === action;
                return (
                  <Button
                    key={action}
                    type="button"
                    size="sm"
                    variant={destructive ? 'destructive' : 'outline'}
                    disabled={busy}
                    onClick={() => handleActionClick(action)}
                  >
                    {isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {COMMERCIAL_ACTION_LABELS[action]}
                  </Button>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-xs text-muted-foreground">
              No hay acciones comerciales disponibles en el estado actual.
            </p>
          )}
        </>
      )}

      <AlertDialog
        open={confirmAction != null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction
                ? COMMERCIAL_ACTION_LABELS[confirmAction]
                : 'Confirmar'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'cancel_now'
                ? 'La cancelación es inmediata: el acceso operativo de la farmacia quedará bloqueado. Los datos y usuarios se conservan. Esta acción no archiva la farmacia.'
                : confirmAction === 'suspend_for_nonpayment'
                  ? 'La farmacia quedará suspendida por impago y sin acceso operativo. Los datos, usuarios y configuración se conservan.'
                  : '¿Confirmas esta operación?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !confirmAction}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (confirmAction) void runAction(confirmAction);
              }}
            >
              {busy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
