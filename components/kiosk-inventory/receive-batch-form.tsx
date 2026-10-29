'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { receiveKioskBatchAction } from '@/app/(app)/inventario-kioskos/actions';
import { EquipmentSerialHelp } from '@/components/kiosk-inventory/equipment-serial-help';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function ReceiveBatchForm() {
  const router = useRouter();
  const [count, setCount] = React.useState(1);
  const [model, setModel] = React.useState('');
  const [vendor, setVendor] = React.useState('');
  const [receivedAt, setReceivedAt] = React.useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [purchaseOrderRef, setPurchaseOrderRef] = React.useState('');
  const [serialsText, setSerialsText] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await receiveKioskBatchAction({
        count,
        model,
        vendor,
        receivedAt,
        purchaseOrderRef,
        serialsText,
        notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(
        result.codes?.length
          ? `${result.message} Códigos: ${result.codes.join(', ')}`
          : result.message ?? 'Lote registrado.'
      );
      setCount(1);
      setSerialsText('');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
    >
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          Registrar recepción (lote)
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Crea un activo individual por unidad con identificador permanente
          (KSK-…). Tablet e impresora viajan juntas; la serie opcional es la del
          conjunto (Serial USB ICOD). No reutiliza códigos ni altera el
          simulador comercial.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Unidades</Label>
          <Input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Fecha de recepción</Label>
          <Input
            type="date"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>N.º pedido (opc.)</Label>
          <Input
            value={purchaseOrderRef}
            onChange={(e) => setPurchaseOrderRef(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Modelo</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Proveedor</Label>
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>
          N.º de serie del conjunto FarmaFácil (opc., una por línea)
        </Label>
        <Textarea
          value={serialsText}
          onChange={(e) => setSerialsText(e.target.value)}
          rows={3}
          placeholder="Serial USB ICOD del diagnóstico. Si las indiques, tantas como unidades."
        />
        <p className="text-[11px] text-muted-foreground">
          Sin serie → «Pendiente de identificar». Con serie → «En almacén». El
          envío a farmacia no exige tenerla todavía. No se permiten duplicados.
        </p>
      </div>
      <EquipmentSerialHelp />
      <div className="space-y-1.5">
        <Label>Notas</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Registrando…
          </>
        ) : (
          'Dar de alta en almacén'
        )}
      </Button>
    </form>
  );
}
