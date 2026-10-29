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
import type { KioskAssetDetail } from '@/lib/kiosk-inventory/types';
import { KIOSK_ASSET_STATUS_LABELS } from '@/lib/kiosk-inventory/types';
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

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={`/inventario-kioskos/${asset.id}/pegatina`}>
            <Printer className="mr-2 h-4 w-4" />
            Pegatina KSK + QR
          </Link>
        </Button>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-sm font-semibold">
          Número de serie del conjunto FarmaFácil
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Código permanente: <strong>{asset.assetCode}</strong> · Estado:{' '}
          {KIOSK_ASSET_STATUS_LABELS[asset.status]}
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
        <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="text-sm font-semibold">Envío / asignación a farmacia</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            La farmacia puede cambiar; el código KSK y el historial se
            conservan. No hace falta tener la serie para enviar.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Farmacia destino</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={pharmacyId}
                onChange={(e) => setPharmacyId(e.target.value)}
                disabled={busy}
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
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha instalación / recepción (opc.)</Label>
              <Input
                type="date"
                value={installedAt}
                onChange={(e) => setInstalledAt(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              disabled={busy || !pharmacyId}
              onClick={() =>
                void run(() =>
                  assignKioskAssetAction({
                    assetId: asset.id,
                    pharmacyId,
                    shippedAt,
                    installedAt: installedAt || null,
                  })
                )
              }
            >
              Asignar / enviar
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  unassignKioskAssetAction({
                    assetId: asset.id,
                    nextStatus: asset.equipmentSerial
                      ? 'warehouse'
                      : 'pending_identification',
                  })
                )
              }
            >
              Desvincular
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  setKioskAssetStatusAction({
                    assetId: asset.id,
                    status: 'repair',
                  })
                )
              }
            >
              En reparación
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  setKioskAssetStatusAction({
                    assetId: asset.id,
                    status: 'retired',
                  })
                )
              }
            >
              Retirar
            </Button>
          </div>
        </section>
      ) : null}

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
