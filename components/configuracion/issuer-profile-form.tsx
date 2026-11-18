'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { saveIssuerProfileAction } from '@/app/(app)/configuracion/emisor/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Initial = {
  id: string | null;
  commercialName: string;
  legalName: string;
  taxId: string;
  fiscalAddress: string;
  phone: string;
  billingEmail: string;
  web: string;
  bankIban: string;
  bankHolder: string;
  notes: string;
};

export function IssuerProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState(initial);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await saveIssuerProfileAction(form);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Perfil de emisor guardado.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function set<K extends keyof Initial>(key: K, value: Initial[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-soft">
      <p className="text-xs text-muted-foreground">
        Los campos fiscales vacíos son intencionados hasta disponer de datos
        verificados (sociedad en enero). No uses ReBoTech Solutions S.L. como
        sociedad constituida.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre comercial" value={form.commercialName} onChange={(v) => set('commercialName', v)} required />
        <Field label="Nombre / razón social" value={form.legalName} onChange={(v) => set('legalName', v)} />
        <Field label="NIF (solo si verificado)" value={form.taxId} onChange={(v) => set('taxId', v)} />
        <Field label="Teléfono" value={form.phone} onChange={(v) => set('phone', v)} />
        <Field label="Email facturación" value={form.billingEmail} onChange={(v) => set('billingEmail', v)} />
        <Field label="Web" value={form.web} onChange={(v) => set('web', v)} />
      </div>
      <div className="space-y-1.5">
        <Label>Domicilio fiscal (solo si verificado)</Label>
        <Textarea
          value={form.fiscalAddress}
          onChange={(e) => set('fiscalAddress', e.target.value)}
          rows={2}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="IBAN (solo si verificado)" value={form.bankIban} onChange={(v) => set('bankIban', v)} />
        <Field label="Titular cuenta" value={form.bankHolder} onChange={(v) => set('bankHolder', v)} />
      </div>
      <div className="space-y-1.5">
        <Label>Notas internas</Label>
        <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando…
          </>
        ) : (
          'Guardar'
        )}
      </Button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
