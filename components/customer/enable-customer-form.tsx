'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, UserCheck } from 'lucide-react';

import { enableCustomerSelfAction } from '@/app/e/[publicId]/cuenta/actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function EnableCustomerForm({
  publicId,
  redirectTo,
  defaultFirstName,
  defaultLastName,
  defaultPhone,
}: {
  publicId?: string;
  redirectTo?: string;
  defaultFirstName?: string | null;
  defaultLastName?: string | null;
  defaultPhone?: string | null;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = React.useState(defaultFirstName ?? '');
  const [lastName, setLastName] = React.useState(defaultLastName ?? '');
  const [phone, setPhone] = React.useState(defaultPhone ?? '');
  const [privacyAccepted, setPrivacyAccepted] = React.useState(false);
  const [marketingConsent, setMarketingConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const afterEnable =
    redirectTo ||
    (publicId ? `/e/${publicId}/cuenta` : '/cuenta/mis-farmacias');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await enableCustomerSelfAction({
        privacyAccepted,
        marketingConsent,
        firstName,
        lastName,
        phone,
        publicId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(afterEnable);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Activar mi cuenta de cliente
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Conservas tu acceso profesional. Al activar Cliente podrás usar Mis
          farmacias, direcciones y pedidos con la misma cuenta.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="en-first">Nombre</Label>
            <Input
              id="en-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={busy}
              autoComplete="given-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="en-last">Apellidos</Label>
            <Input
              id="en-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={busy}
              autoComplete="family-name"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="en-phone">Teléfono</Label>
          <Input
            id="en-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={busy}
            autoComplete="tel"
            placeholder="612 345 678"
          />
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={privacyAccepted}
              onCheckedChange={(v) => setPrivacyAccepted(v === true)}
              className="mt-0.5"
              disabled={busy}
            />
            <span>
              Acepto las{' '}
              <Link href="/legal/terminos" className="text-primary underline">
                condiciones
              </Link>{' '}
              y la{' '}
              <Link href="/legal/privacidad" className="text-primary underline">
                política de privacidad
              </Link>
              . <span className="text-destructive">Obligatorio</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={marketingConsent}
              onCheckedChange={(v) => setMarketingConsent(v === true)}
              className="mt-0.5"
              disabled={busy}
            />
            <span>
              Quiero recibir comunicaciones comerciales de FarmaFácil
              (opcional).
            </span>
          </label>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full gap-1.5" disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Activando…
            </>
          ) : (
            <>
              <UserCheck className="h-4 w-4" />
              Activar área cliente
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
