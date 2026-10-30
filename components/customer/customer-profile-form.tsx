'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import type { CustomerProfile } from '@/lib/customer/queries';
import {
  signOutCustomerAction,
  updateCustomerProfileAction,
} from '@/app/e/[publicId]/cuenta/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export function CustomerProfileForm({
  publicId,
  profile,
}: {
  publicId: string;
  profile: CustomerProfile;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = React.useState(profile.firstName ?? '');
  const [lastName, setLastName] = React.useState(profile.lastName ?? '');
  const [email, setEmail] = React.useState(profile.email);
  const [phone, setPhone] = React.useState(profile.phone ?? '');
  const [marketingConsent, setMarketingConsent] = React.useState(
    Boolean(profile.marketingConsentAt)
  );
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await updateCustomerProfileAction({
        firstName,
        lastName,
        phone,
        email,
        marketingConsent,
        publicId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        result.emailChangePending
          ? 'Perfil guardado. Te hemos enviado un email para confirmar el nuevo correo; hasta entonces sigue vigente el actual.'
          : 'Perfil actualizado.'
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    setBusy(true);
    try {
      await signOutCustomerAction(publicId);
      router.push(`/e/${publicId}/cuenta`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={onSave}
        className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Apellidos</Label>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <p className="text-[11px] text-muted-foreground">
            El email es la identidad de acceso. Si lo cambias, Supabase pedirá
            confirmación antes de aplicarlo.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Teléfono</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            required
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={marketingConsent}
            onCheckedChange={(v) => setMarketingConsent(v === true)}
            className="mt-0.5"
          />
          <span>Consentimiento comercial (opcional)</span>
        </label>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        {message ? (
          <p className="text-sm text-emerald-700">{message}</p>
        ) : null}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando…
            </>
          ) : (
            'Guardar cambios'
          )}
        </Button>
      </form>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={busy}
        onClick={() => void onSignOut()}
      >
        Cerrar sesión
      </Button>
    </div>
  );
}
