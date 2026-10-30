'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { registerCustomerAction } from '@/app/e/[publicId]/cuenta/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export function CustomerRegisterForm({ publicId }: { publicId: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [passwordConfirm, setPasswordConfirm] = React.useState('');
  const [privacyAccepted, setPrivacyAccepted] = React.useState(false);
  const [marketingConsent, setMarketingConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const result = await registerCustomerAction({
        firstName,
        lastName,
        phone,
        email,
        password,
        passwordConfirm,
        privacyAccepted,
        marketingConsent,
        publicId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.needsEmailConfirmation) {
        setSuccess(
          `Cuenta creada. Te hemos enviado un email a ${result.email} para confirmarla. Hasta entonces no has iniciado sesión.`
        );
        return;
      }
      setSuccess('Cuenta creada e iniciada sesión.');
      router.push(`/e/${publicId}/cuenta`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="c-first">Nombre</Label>
          <Input
            id="c-first"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-last">Apellidos</Label>
          <Input
            id="c-last"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-phone">Teléfono</Label>
        <Input
          id="c-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          placeholder="612 345 678"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-email">Email</Label>
        <Input
          id="c-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-pass">Contraseña</Label>
        <Input
          id="c-pass"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-pass2">Confirmar contraseña</Label>
        <Input
          id="c-pass2"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={privacyAccepted}
            onCheckedChange={(v) => setPrivacyAccepted(v === true)}
            className="mt-0.5"
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
          />
          <span>
            Quiero recibir comunicaciones comerciales de FarmaFácil (opcional).
          </span>
        </label>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900">
          {success}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creando cuenta…
          </>
        ) : (
          'Crear cuenta'
        )}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link
          href={`/e/${publicId}/cuenta/entrar`}
          className="font-medium text-primary hover:underline"
        >
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}
