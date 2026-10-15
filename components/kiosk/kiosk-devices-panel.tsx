'use client';

import * as React from 'react';
import { Loader2, MonitorSmartphone, RefreshCw, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import type { KioskDeviceRow } from '@/lib/kiosk/devices';
import {
  createKioskPairingCodeAction,
  revokeKioskDeviceAction,
} from '@/app/f/[pharmacyId]/dispositivos/actions';
import { KioskCommercialBanner } from '@/components/kiosk/kiosk-commercial-banner';
import { KioskEntitlementAdminPanel } from '@/components/kiosk/kiosk-entitlement-admin-panel';
import type {
  KioskCommercialUiState,
  KioskEntitlementRecord,
} from '@/lib/kiosk/entitlement-status';
import {
  kioskDeviceCommercialServiceLabel,
  kioskDeviceTechnicalLabel,
  resolveKioskDeviceCommercialService,
} from '@/lib/kiosk/device-status-display';
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
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';

export function KioskDevicesPanel({
  pharmacyId,
  devices: initialDevices,
  loadError,
  commercialUiState = 'not_contracted',
  entitlement = null,
  moduleUsable = false,
  showAdminControls = false,
}: {
  pharmacyId: string;
  devices: KioskDeviceRow[];
  loadError?: string | null;
  commercialUiState?: KioskCommercialUiState;
  entitlement?: KioskEntitlementRecord | null;
  moduleUsable?: boolean;
  /** Controles SuperAdmin de activación del add-on */
  showAdminControls?: boolean;
}) {
  const router = useRouter();
  const [devices, setDevices] = React.useState(initialDevices);
  const [creating, setCreating] = React.useState(false);
  const [pairingCode, setPairingCode] = React.useState<{
    displayCode: string;
    expiresAt: string;
  } | null>(null);
  const [revokeTarget, setRevokeTarget] = React.useState<KioskDeviceRow | null>(
    null
  );
  const [revoking, setRevoking] = React.useState(false);

  React.useEffect(() => {
    setDevices(initialDevices);
  }, [initialDevices]);

  async function onCreateCode() {
    if (!moduleUsable) {
      toast.error(
        'El módulo Kiosko no está activo. No se pueden generar códigos de vinculación.'
      );
      return;
    }
    setCreating(true);
    setPairingCode(null);
    const result = await createKioskPairingCodeAction(pharmacyId);
    setCreating(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setPairingCode({
      displayCode: result.displayCode,
      expiresAt: result.expiresAt,
    });
    toast.success('Código generado. Válido 10 minutos.');
    router.refresh();
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    const result = await revokeKioskDeviceAction({
      pharmacyId,
      deviceId: revokeTarget.id,
    });
    setRevoking(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    setRevokeTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {showAdminControls ? (
        <KioskEntitlementAdminPanel
          pharmacyId={pharmacyId}
          uiState={commercialUiState}
          entitlement={entitlement}
        />
      ) : (
        <KioskCommercialBanner
          uiState={commercialUiState}
          entitlement={entitlement}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Dispositivos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vincula tablets Android con un código de un solo uso (10 minutos).
            El estado técnico indica si el dispositivo sigue emparejado; el
            comercial, si el servicio Kiosko está habilitado por suscripción.
            Puedes revocar un dispositivo aunque el módulo esté bloqueado.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => void onCreateCode()}
          disabled={creating || !moduleUsable}
          className="gap-1.5"
          title={
            moduleUsable
              ? undefined
              : 'El módulo Kiosko no está activo o en prueba válida'
          }
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Generar código
        </Button>
      </div>

      {pairingCode ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Código de vinculación
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tracking-widest text-foreground">
            {pairingCode.displayCode}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Introduce este código en la tablet en{' '}
            <span className="font-medium text-foreground">/k/pair</span>. Caduca:{' '}
            {formatDateTime(pairingCode.expiresAt)}. No se volverá a mostrar.
          </p>
        </div>
      ) : null}

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : null}

      {devices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <MonitorSmartphone className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            Ningún dispositivo vinculado
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Genera un código y ábrelo en la tablet para emparejar.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Estado técnico</th>
                <th className="px-4 py-3 font-medium">Estado comercial</th>
                <th className="px-4 py-3 font-medium">Vinculado</th>
                <th className="px-4 py-3 font-medium">Última actividad</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const commercial = resolveKioskDeviceCommercialService({
                  deviceStatus: d.status,
                  moduleUsable,
                });
                return (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {d.displayName}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          d.status === 'active' ? 'secondary' : 'outline'
                        }
                      >
                        {kioskDeviceTechnicalLabel(d.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {commercial === 'not_applicable' ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <Badge
                          variant={
                            commercial === 'enabled' ? 'default' : 'destructive'
                          }
                        >
                          {kioskDeviceCommercialServiceLabel(commercial)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(d.pairedAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.lastSeenAt ? formatDateTime(d.lastSeenAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {d.status === 'active' ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setRevokeTarget(d)}
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                          Revocar
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AlertDialog
        open={revokeTarget != null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar dispositivo?</AlertDialogTitle>
            <AlertDialogDescription>
              «{revokeTarget?.displayName}» dejará de poder usar el kiosko de
              esta farmacia. Podrás vincular otra tablet con un código nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={revoking}
              onClick={(e) => {
                e.preventDefault();
                void confirmRevoke();
              }}
            >
              {revoking ? 'Revocando…' : 'Revocar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
