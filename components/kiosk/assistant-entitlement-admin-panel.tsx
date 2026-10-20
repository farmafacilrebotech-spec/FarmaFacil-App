'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
  setPharmacyAssistantEntitlementAction,
  type AssistantEntitlementAction,
} from '@/app/(app)/farmacias/assistant-entitlement-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type {
  AssistantCommercialUiState,
  AssistantEntitlementRecord,
} from '@/lib/kiosk/assistant/entitlement-status';

function defaultDemoEndLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function stateLabel(uiState: AssistantCommercialUiState): string {
  switch (uiState) {
    case 'demo_active':
      return 'Demo activa (autorizada expresamente)';
    case 'demo_expired':
      return 'Demo caducada';
    case 'contracted_active':
      return 'Contratado activo';
    case 'suspended':
      return 'Suspendido';
    case 'cancelled':
      return 'Cancelado / desactivado';
    default:
      return 'No contratado (sin demo)';
  }
}

export function AssistantEntitlementAdminPanel({
  pharmacyId,
  uiState,
  entitlement,
  usageRequestCount = 0,
  usagePeriodYm = '',
}: {
  pharmacyId: string;
  uiState: AssistantCommercialUiState;
  entitlement: AssistantEntitlementRecord | null;
  usageRequestCount?: number;
  usagePeriodYm?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<AssistantEntitlementAction | null>(
    null
  );
  const [demoEndsAt, setDemoEndsAt] = React.useState(defaultDemoEndLocal);
  const [monthlyLimit, setMonthlyLimit] = React.useState(
    String(entitlement?.monthlyRequestLimit ?? 1000)
  );
  const [pharmacistConsult, setPharmacistConsult] = React.useState(
    entitlement?.pharmacistConsultEnabled ?? false
  );
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    setMonthlyLimit(String(entitlement?.monthlyRequestLimit ?? 1000));
    setPharmacistConsult(entitlement?.pharmacistConsultEnabled ?? false);
  }, [entitlement]);

  async function run(
    action: AssistantEntitlementAction,
    opts?: { limit?: number; consult?: boolean }
  ) {
    setBusy(action);
    const limit = opts?.limit ?? Number(monthlyLimit);
    const result = await setPharmacyAssistantEntitlementAction({
      pharmacyId,
      action,
      monthlyRequestLimit:
        action === 'activate_demo' ||
        action === 'activate_contracted' ||
        action === 'update_limits'
          ? Number.isFinite(limit)
            ? limit
            : null
          : null,
      endsAt:
        action === 'activate_demo' ? new Date(demoEndsAt).toISOString() : null,
      pharmacistConsultEnabled:
        action === 'activate_contracted' || action === 'update_limits'
          ? (opts?.consult ?? pharmacistConsult)
          : null,
      reason: reason.trim() || null,
    });
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    router.refresh();
  }

  const canSuspend = uiState === 'demo_active' || uiState === 'contracted_active';
  const canReactivate = uiState === 'suspended';
  const canCancel =
    uiState === 'demo_active' ||
    uiState === 'contracted_active' ||
    uiState === 'suspended' ||
    uiState === 'demo_expired';
  const canUpdate =
    uiState === 'demo_active' || uiState === 'contracted_active';

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Asistente IA — gestión comercial (SuperAdmin)
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Add-on independiente. La demo no se concede automáticamente: requiere
          activación expresa. No registra cobros.
        </p>
      </div>

      <div className="rounded-lg border border-border/80 bg-muted/40 px-3 py-2 text-sm">
        <p className="font-medium text-foreground">{stateLabel(uiState)}</p>
        {entitlement?.endsAt ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Vence: {new Date(entitlement.endsAt).toLocaleString('es-ES')}
          </p>
        ) : null}
        <p className="mt-0.5 text-xs text-muted-foreground">
          Límite mensual:{' '}
          {entitlement?.monthlyRequestLimit ?? '—'} peticiones
          {usagePeriodYm
            ? ` · Uso ${usagePeriodYm}: ${usageRequestCount}`
            : ''}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="assistant-demo-end">Vencimiento demo</Label>
          <Input
            id="assistant-demo-end"
            type="datetime-local"
            value={demoEndsAt}
            onChange={(e) => setDemoEndsAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assistant-limit">Límite mensual (peticiones)</Label>
          <Input
            id="assistant-limit"
            type="number"
            min={1}
            max={1000000}
            value={monthlyLimit}
            onChange={(e) => setMonthlyLimit(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="assistant-reason">Motivo (opcional)</Label>
          <Input
            id="assistant-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="p. ej. piloto comercial, cortesía…"
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 sm:col-span-2">
          <div>
            <p className="text-sm font-medium">Consultas al farmacéutico</p>
            <p className="text-xs text-muted-foreground">
              Reserva futura (mensajería en Fase 2B). Solo en modo contratado.
            </p>
          </div>
          <Switch
            checked={pharmacistConsult}
            onCheckedChange={setPharmacistConsult}
            disabled={uiState !== 'contracted_active' && busy == null}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={busy != null}
          onClick={() => void run('activate_demo', { limit: Number(monthlyLimit) || 50 })}
        >
          {busy === 'activate_demo' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Activar DEMO
        </Button>
        <Button
          type="button"
          disabled={busy != null}
          onClick={() =>
            void run('activate_contracted', {
              limit: Number(monthlyLimit) || 1000,
              consult: pharmacistConsult,
            })
          }
        >
          {busy === 'activate_contracted' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Activar contratado
        </Button>
        {canUpdate ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy != null}
            onClick={() =>
              void run('update_limits', {
                limit: Number(monthlyLimit) || 1000,
                consult: pharmacistConsult,
              })
            }
          >
            {busy === 'update_limits' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Guardar límites
          </Button>
        ) : null}
        {canSuspend ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy != null}
            onClick={() => void run('suspend')}
          >
            {busy === 'suspend' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Suspender
          </Button>
        ) : null}
        {canReactivate ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy != null}
            onClick={() => void run('reactivate')}
          >
            {busy === 'reactivate' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Reactivar
          </Button>
        ) : null}
        {canCancel ? (
          <Button
            type="button"
            variant="destructive"
            disabled={busy != null}
            onClick={() => void run('cancel')}
          >
            {busy === 'cancel' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Desactivar
          </Button>
        ) : null}
      </div>
    </div>
  );
}
