'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';

import type { CustomerAddress } from '@/lib/customer/queries';
import {
  deleteCustomerAddressAction,
  upsertCustomerAddressAction,
} from '@/app/e/[publicId]/cuenta/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export function CustomerAddressesPanel({
  publicId,
  addresses,
}: {
  publicId: string;
  addresses: CustomerAddress[];
}) {
  const router = useRouter();
  const [line1, setLine1] = React.useState('');
  const [line2, setLine2] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');
  const [city, setCity] = React.useState('');
  const [province, setProvince] = React.useState('');
  const [label, setLabel] = React.useState('');
  const [isDefault, setIsDefault] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await upsertCustomerAddressAction({
        line1,
        line2,
        postalCode,
        city,
        province,
        label,
        isDefault,
        publicId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLine1('');
      setLine2('');
      setPostalCode('');
      setCity('');
      setProvince('');
      setLabel('');
      setIsDefault(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    setBusy(true);
    try {
      await deleteCustomerAddressAction({ id, publicId });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Las direcciones son opcionales y solo se usan para pedidos con envío. No
        son necesarias para crear la cuenta.
      </p>

      {addresses.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Aún no tienes direcciones guardadas.
        </p>
      ) : (
        <ul className="space-y-2">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="text-sm">
                {a.label ? (
                  <p className="font-medium text-foreground">{a.label}</p>
                ) : null}
                <p>{a.line1}</p>
                {a.line2 ? <p>{a.line2}</p> : null}
                <p>
                  {a.postalCode} {a.city}
                  {a.province ? ` · ${a.province}` : ''}
                </p>
                {a.isDefault ? (
                  <p className="mt-1 text-xs text-primary">Predeterminada</p>
                ) : null}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={busy}
                onClick={() => void onDelete(a.id)}
                aria-label="Eliminar dirección"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={onAdd}
        className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft"
      >
        <h3 className="text-sm font-semibold">Añadir dirección</h3>
        <div className="space-y-1.5">
          <Label>Etiqueta (opcional)</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Casa, trabajo…"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Dirección</Label>
          <Input
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Complemento</Label>
          <Input value={line2} onChange={(e) => setLine2(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Código postal</Label>
            <Input
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ciudad</Label>
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Provincia</Label>
          <Input value={province} onChange={(e) => setProvince(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={isDefault}
            onCheckedChange={(v) => setIsDefault(v === true)}
          />
          Usar como predeterminada
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando…
            </>
          ) : (
            'Guardar dirección'
          )}
        </Button>
      </form>
    </div>
  );
}
