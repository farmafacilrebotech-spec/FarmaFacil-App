'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
  setPharmacyKioskEntitlementAction,
  type KioskEntitlementAction,
} from '@/app/(app)/farmacias/kiosk-entitlement-actions';
import { KioskCommercialBanner } from '@/components/kiosk/kiosk-commercial-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
  KioskCommercialUiState,
  KioskEntitlementRecord,
} from '@/lib/kiosk/entitlement-status';

function defaultTrialEndLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function KioskEntitlementAdminPanel({
  pharmacyId,
  uiState,
  entitlement,
}: {
  pharmacyId: string;
  uiState: KioskCommercialUiState;
  entitlement: KioskEntitlementRecord | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<KioskEntitlementAction | null>(null);
  const [trialEndsAt, setTrialEndsAt] = React.useState(defaultTrialEndLocal);
  const [reason, setReason] = React.useState('');

  async function run(action: KioskEntitlementAction) {
    setBusy(action);
    const result = await setPharmacyKioskEntitlementAction({
      pharmacyId,
      action,
      endsAt:
        action === 'activate_trial'
          ? new Date(trialEndsAt).toISOString()
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

  const canSuspend = uiState === 'active' || uiState === 'trial_active';
  const canReactivate = uiState === 'suspended';
  const canCancel =
    uiState === 'active' ||
    uiState === 'trial_active' ||
    uiState === 'suspended' ||
    uiState === 'trial_expired';

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Gestión comercial (SuperAdmin)
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          El Kiosko es un add-on independiente del plan. Estas acciones no
          registran cobros ni pagos.
        </p>
      </div>

      <KioskCommercialBanner uiState={uiState} entitlement={entitlement} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="kiosk-trial-end">Vencimiento prueba</Label>
          <Input
            id="kiosk-trial-end"
            type="datetime-local"
            value={trialEndsAt}
            onChange={(e) => setTrialEndsAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kiosk-reason">Motivo (opcional)</Label>
          <Input
            id="kiosk-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="p. ej. prueba comercial, cortesía…"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy != null}
          onClick={() => void run('activate_trial')}
        >
          {busy === 'activate_trial' ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          Activar prueba
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy != null}
          onClick={() => void run('activate_addon')}
        >
          {busy === 'activate_addon' ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          Activar add-on
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy != null || !canSuspend}
          onClick={() => void run('suspend')}
        >
          {busy === 'suspend' ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          Suspender
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy != null || !canReactivate}
          onClick={() => void run('reactivate')}
        >
          {busy === 'reactivate' ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          Reactivar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={busy != null || !canCancel}
          onClick={() => void run('cancel')}
        >
          {busy === 'cancel' ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : null}
          Cancelar módulo
        </Button>
      </div>
    </div>
  );
}
