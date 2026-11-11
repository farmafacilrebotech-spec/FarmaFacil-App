'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import {
  COMMERCIAL_ACTION_LABELS,
  COMMERCIAL_ACTION_SUCCESS,
  commercialActionRequiresConfirm,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ACTION_CONSEQUENCES: Record<CommercialAction, string> = {
  cancel_at_period_end:
    'El acceso se mantiene hasta el fin del periodo facturado. Después la suscripción quedará cancelada. No archiva la farmacia ni borra datos.',
  cancel_now:
    'Cancelación inmediata: el acceso operativo queda bloqueado ya. Los datos y usuarios se conservan. No archiva la farmacia.',
  start_nonpayment_grace:
    'Se registra impago y se abre una gracia de 7 días con acceso operativo. Tras la gracia puede procederse a suspensión.',
  suspend_for_nonpayment:
    'La farmacia queda suspendida por impago y sin acceso operativo. Datos, usuarios y configuración se conservan.',
  reactivate:
    'Se restablece la suscripción y el acceso operativo según el estado comercial vigente.',
};

const ACTION_GROUPS: {
  title: string;
  actions: CommercialAction[];
}[] = [
  {
    title: 'Cancelación',
    actions: ['cancel_at_period_end', 'cancel_now'],
  },
  {
    title: 'Impago',
    actions: ['start_nonpayment_grace', 'suspend_for_nonpayment'],
  },
  {
    title: 'Reactivación',
    actions: ['reactivate'],
  },
];

export function ManageSubscriptionDialog({
  open,
  onOpenChange,
  pharmacyId,
  visibleActions,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacyId: string;
  visibleActions: CommercialAction[];
  onDone: (message: string) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [pending, setPending] = React.useState<CommercialAction | null>(null);
  const [confirmAction, setConfirmAction] =
    React.useState<CommercialAction | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
      setConfirmAction(null);
      setPending(null);
      setBusy(false);
    }
  }, [open]);

  async function runAction(action: CommercialAction) {
    if (busy) return;
    setBusy(true);
    setPending(action);
    setError(null);
    try {
      const result = await transitionPharmacySubscriptionAction(
        pharmacyId,
        action
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone(COMMERCIAL_ACTION_SUCCESS[action]);
      onOpenChange(false);
    } catch {
      setError(
        'No se ha podido completar la operación comercial. Inténtalo de nuevo.'
      );
    } finally {
      setBusy(false);
      setPending(null);
      setConfirmAction(null);
    }
  }

  function handleSelect(action: CommercialAction) {
    if (commercialActionRequiresConfirm(action) || action === 'cancel_at_period_end') {
      setConfirmAction(action);
      return;
    }
    void runAction(action);
  }

  const visible = new Set(visibleActions);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gestionar suscripción</DialogTitle>
            <DialogDescription>
              Elige una operación. No se ejecuta nada al abrir este panel; las
              acciones sensibles requieren confirmación explícita.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {ACTION_GROUPS.map((group) => {
              const actions = group.actions.filter((a) => visible.has(a));
              if (actions.length === 0) return null;
              return (
                <section key={group.title} className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </h3>
                  <ul className="space-y-2">
                    {actions.map((action) => {
                      const destructive =
                        action === 'cancel_now' ||
                        action === 'suspend_for_nonpayment';
                      return (
                        <li
                          key={action}
                          className="rounded-xl border border-border p-3"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {COMMERCIAL_ACTION_LABELS[action]}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {ACTION_CONSEQUENCES[action]}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            className="mt-3"
                            variant={destructive ? 'destructive' : 'outline'}
                            disabled={busy}
                            onClick={() => handleSelect(action)}
                          >
                            {busy && pending === action ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Seleccionar
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            {visibleActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay acciones comerciales disponibles en el estado actual.
              </p>
            ) : null}

            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmAction != null}
        onOpenChange={(next) => {
          if (!next && !busy) setConfirmAction(null);
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
              {confirmAction
                ? ACTION_CONSEQUENCES[confirmAction]
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
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
