'use client';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, Printer } from 'lucide-react';
import { useRouter } from 'next/navigation';

import {
  assignKioskAssetAction,
  setKioskAssetSerialsAction,
  setKioskAssetStatusAction,
  setKioskInsuranceAction,
  unassignKioskAssetAction,
  updateKioskAssetMetaAction,
} from '@/app/(app)/inventario-kioskos/actions';
import { EquipmentSerialHelp } from '@/components/kiosk-inventory/equipment-serial-help';
import { InventoryStatusBadge } from '@/components/kiosk-inventory/inventory-status-badge';
import type { KioskAssetDetail } from '@/lib/kiosk-inventory/types';
import {
  INVENTORY_UI_STATUS_LABELS,
  appendAssetNote,
  assetStatusToUi,
} from '@/lib/kiosk-inventory/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function AssetDetailPanels({
  asset,
  pharmacies,
  canWrite,
}: {
  asset: KioskAssetDetail;
  pharmacies: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [equipmentSerial, setEquipmentSerial] = React.useState(
    asset.equipmentSerial ?? ''
  );
  const [model, setModel] = React.useState(asset.model ?? '');
  const [vendor, setVendor] = React.useState(asset.vendor ?? '');
  const [receivedAt, setReceivedAt] = React.useState(asset.receivedAt ?? '');
  const [po, setPo] = React.useState(asset.purchaseOrderRef ?? '');
  const [notes, setNotes] = React.useState(asset.notes ?? '');

  const [pharmacyId, setPharmacyId] = React.useState(
    asset.currentPharmacyId ?? pharmacies[0]?.id ?? ''
  );
  const [shippedAt, setShippedAt] = React.useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [installedAt, setInstalledAt] = React.useState('');
  const [policyRef, setPolicyRef] = React.useState('');
  const [insurer, setInsurer] = React.useState('');
  const [coverageStart, setCoverageStart] = React.useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [statusReason, setStatusReason] = React.useState('');
  const [exhibitionLocation, setExhibitionLocation] = React.useState(
    asset.exhibitionLocation ?? ''
  );

  const warehouseStatus = asset.equipmentSerial
    ? ('warehouse' as const)
    : ('pending_identification' as const);
  const uiStatus = asset.uiStatus ?? assetStatusToUi(asset.status);
  const statusLabel =
    INVENTORY_UI_STATUS_LABELS[uiStatus] ??
    asset.status ??
    'Sin estado';
  const retired = asset.status === 'retired';

  async function run(
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>
  ) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await fn();
      if (!result.ok) {
        setError(result.error ?? 'Error');
        return;
      }
      setMessage(result.message ?? 'Guardado.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {asset.needsIdentification ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Pendiente de identificar: falta el número de serie del conjunto
          (campo <strong>Serial</strong> del Diagnóstico USB ICOD). El código{' '}
          <strong>{asset.assetCode}</strong> ya es el identificador interno
          permanente; el envío a farmacia no está bloqueado por esta falta.
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Código permanente
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {asset.assetCode}
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <p className="text-xs text-muted-foreground">Estado operativo</p>
            <InventoryStatusBadge uiStatus={uiStatus} />
            <p className="text-xs font-medium text-foreground">{statusLabel}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Ubicación: {asset.locationLabel ?? '—'}
          {asset.needsIdentification
            ? ' · Indicador secundario: sin serie (no bloquea asignación/exposición)'
            : ''}
        </p>
        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href={`/inventario-kioskos/${asset.id}/pegatina`}>
              <Printer className="mr-2 h-4 w-4" />
              Pegatina KSK + QR
            </Link>
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-semibold">
          Número de serie del conjunto FarmaFácil
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Dato técnico independiente del estado operativo.
        </p>
        <div className="mt-4 space-y-1.5">
          <Label>N.º de serie (Serial USB ICOD)</Label>
          <Input
            value={equipmentSerial}
            onChange={(e) => setEquipmentSerial(e.target.value)}
            disabled={!canWrite || busy}
            placeholder="Valor del campo Serial del diagnóstico USB"
          />
          <p className="text-[11px] text-muted-foreground">
            Identifica el conjunto tablet + impresora. Debe ser único en el
            inventario.
          </p>
        </div>
        <div className="mt-3">
          <EquipmentSerialHelp />
        </div>
        {canWrite ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={busy || !equipmentSerial.trim()}
              onClick={() =>
                void run(() =>
                  setKioskAssetSerialsAction({
                    assetId: asset.id,
                    equipmentSerial,
                  })
                )
              }
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar número de serie
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  setKioskAssetSerialsAction({
                    assetId: asset.id,
                    markPending: true,
                  })
                )
              }
            >
              Marcar pendiente de identificar
            </Button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-semibold">Datos técnicos</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Modelo</Label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!canWrite || busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Proveedor</Label>
            <Input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              disabled={!canWrite || busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha recepción (almacén)</Label>
            <Input
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              disabled={!canWrite || busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label>N.º pedido</Label>
            <Input
              value={po}
              onChange={(e) => setPo(e.target.value)}
              disabled={!canWrite || busy}
            />
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <Label>Notas</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canWrite || busy}
            rows={2}
          />
        </div>
        {canWrite ? (
          <Button
            className="mt-4"
            disabled={busy}
            onClick={() =>
              void run(() =>
                updateKioskAssetMetaAction({
                  assetId: asset.id,
                  model,
                  vendor,
                  receivedAt,
                  purchaseOrderRef: po,
                  notes,
                })
              )
            }
          >
            Guardar datos
          </Button>
        ) : null}
      </section>

      {canWrite ? (
        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-sm font-semibold">Asignar / enviar</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Asigna el activo a una farmacia real. No requiere serie. No usa
              farmacias ficticias para exposición.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Farmacia destino</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={pharmacyId}
                  onChange={(e) => setPharmacyId(e.target.value)}
                  disabled={busy || retired}
                >
                  {pharmacies.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de envío</Label>
                <Input
                  type="date"
                  value={shippedAt}
                  onChange={(e) => setShippedAt(e.target.value)}
                  disabled={busy || retired}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha instalación / recepción (opc.)</Label>
                <Input
                  type="date"
                  value={installedAt}
                  onChange={(e) => setInstalledAt(e.target.value)}
                  disabled={busy || retired}
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={busy || !pharmacyId || retired}
                onClick={() =>
                  void run(() =>
                    assignKioskAssetAction({
                      assetId: asset.id,
                      pharmacyId,
                      shippedAt,
                      installedAt: installedAt || null,
                      notes: statusReason || undefined,
                    })
                  )
                }
              >
                Asignar / enviar
              </Button>
              <Button
                variant="outline"
                disabled={busy || asset.status !== 'assigned'}
                onClick={() =>
                  void run(() =>
                    unassignKioskAssetAction({
                      assetId: asset.id,
                      endReason: statusReason || 'return_warehouse',
                      nextStatus: warehouseStatus,
                    })
                  )
                }
              >
                Devolver a disponible
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-sm font-semibold">En exposición</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Marca el kiosko como exposición sin asignarlo a una farmacia. La
              ubicación se añade a notas sin borrar el historial previo.
            </p>
            <div className="mt-3 space-y-1.5">
              <Label>Ubicación de exposición</Label>
              <Input
                value={exhibitionLocation}
                onChange={(e) => setExhibitionLocation(e.target.value)}
                disabled={busy || retired}
                placeholder="Oficina, showroom, feria…"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={busy || retired || !exhibitionLocation.trim()}
                onClick={() => {
                  const loc = exhibitionLocation.trim();
                  const stamp = new Date().toLocaleString('es-ES');
                  const line = `Exposición: ${loc} (${stamp})`;
                  void run(async () => {
                    const res = await setKioskAssetStatusAction({
                      assetId: asset.id,
                      status: 'exhibition',
                      notes: line,
                    });
                    if (res.ok) {
                      setNotes(appendAssetNote(asset.notes, line));
                    }
                    return res;
                  });
                }}
              >
                En exposición
              </Button>
              <Button
                variant="outline"
                disabled={busy || asset.status !== 'exhibition'}
                onClick={() => {
                  const line = `Vuelta a disponible desde exposición (${new Date().toLocaleString('es-ES')})`;
                  void run(async () => {
                    const res = await setKioskAssetStatusAction({
                      assetId: asset.id,
                      status: warehouseStatus,
                      notes: line,
                    });
                    if (res.ok) setNotes(appendAssetNote(asset.notes, line));
                    return res;
                  });
                }}
              >
                Volver a disponible
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
            <h2 className="text-sm font-semibold">Reparación y retirada</h2>
            <div className="mt-3 space-y-1.5">
              <Label>Motivo (opc.)</Label>
              <Input
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                disabled={busy}
                placeholder="Motivo del cambio de estado"
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy || retired}
                onClick={() =>
                  void run(() =>
                    setKioskAssetStatusAction({
                      assetId: asset.id,
                      status: 'repair',
                      notes:
                        statusReason.trim() ||
                        `Enviado a reparación (${new Date().toLocaleString('es-ES')})`,
                    })
                  )
                }
              >
                Enviar a reparación
              </Button>
              <Button
                variant="outline"
                disabled={busy || asset.status !== 'repair'}
                onClick={() =>
                  void run(() =>
                    setKioskAssetStatusAction({
                      assetId: asset.id,
                      status: warehouseStatus,
                      notes:
                        statusReason.trim() ||
                        `Recuperado de reparación → disponible (${new Date().toLocaleString('es-ES')})`,
                    })
                  )
                }
              >
                Recuperar de reparación
              </Button>
              <Button
                variant="destructive"
                disabled={busy || retired}
                onClick={() =>
                  void run(() =>
                    setKioskAssetStatusAction({
                      assetId: asset.id,
                      status: 'retired',
                      notes:
                        statusReason.trim() ||
                        `Retirado definitivamente (${new Date().toLocaleString('es-ES')})`,
                    })
                  )
                }
              >
                Retirar definitivamente
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="text-sm font-semibold">Estado operativo</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <InventoryStatusBadge uiStatus={uiStatus} />
            <span className="text-sm font-medium">{statusLabel}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Ubicación: {asset.locationLabel ?? '—'}
          </p>
        </section>
      )}

      {canWrite ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="text-sm font-semibold">Nueva cobertura de seguro</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Referencia póliza</Label>
              <Input
                value={policyRef}
                onChange={(e) => setPolicyRef(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Aseguradora</Label>
              <Input
                value={insurer}
                onChange={(e) => setInsurer(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Inicio cobertura</Label>
              <Input
                type="date"
                value={coverageStart}
                onChange={(e) => setCoverageStart(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <Button
            className="mt-4"
            disabled={busy || !policyRef.trim()}
            onClick={() =>
              void run(() =>
                setKioskInsuranceAction({
                  assetId: asset.id,
                  policyRef,
                  insurerName: insurer,
                  coverageStart,
                })
              )
            }
          >
            Registrar póliza
          </Button>
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-semibold">Historial de estados</h2>
        {!asset.statusEvents || asset.statusEvents.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sin cambios de estado registrados.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {asset.statusEvents.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-border px-3 py-2"
              >
                <p className="font-medium">
                  {e.fromStatus
                    ? `${e.fromStatus} → ${e.toStatus}`
                    : e.toStatus}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString('es-ES')}
                  {e.reason ? ` · ${e.reason}` : ''}
                  {e.createdBy ? ` · ${e.createdBy.slice(0, 8)}…` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-semibold">Historial de asignaciones</h2>
        {asset.assignments.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Sin movimientos.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {asset.assignments.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-border px-3 py-2"
              >
                <p className="font-medium">
                  {a.pharmacyName ?? a.pharmacyId}
                  {!a.endedAt ? (
                    <span className="ml-2 text-xs text-primary">vigente</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.startedAt).toLocaleString('es-ES')}
                  {a.endedAt
                    ? ` → ${new Date(a.endedAt).toLocaleString('es-ES')}`
                    : ' → …'}
                  {a.shippedAt ? ` · Envío ${a.shippedAt}` : ''}
                  {a.installedAt ? ` · Instalación ${a.installedAt}` : ''}
                  {a.endReason ? ` · ${a.endReason}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-semibold">Historial de seguros</h2>
        {asset.insuranceCoverages.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sin pólizas registradas.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {asset.insuranceCoverages.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-border px-3 py-2"
              >
                <p className="font-medium">
                  {c.policyRef}
                  {!c.coverageEnd ? (
                    <span className="ml-2 text-xs text-primary">vigente</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.insurerName ? `${c.insurerName} · ` : ''}
                  {c.coverageStart}
                  {c.coverageEnd ? ` → ${c.coverageEnd}` : ' → …'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
