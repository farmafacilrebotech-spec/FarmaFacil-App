'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';

import { registerCustomerAction } from '@/app/e/[publicId]/cuenta/actions';
import { CustomerAuthLink } from '@/components/customer/customer-auth-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export function CustomerRegisterForm({
  publicId,
  redirectTo,
  title = 'Crear cuenta',
  subtitle,
}: {
  publicId?: string;
  redirectTo?: string;
  title?: string;
  subtitle?: string | null;
}) {
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

  const afterRegister =
    redirectTo ||
    (publicId ? `/e/${publicId}/cuenta` : '/cuenta/mis-farmacias');
  const loginHref = publicId
    ? `/e/${publicId}/cuenta/entrar`
    : '/cuenta/entrar';

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
        if (result.code === 'email_taken') {
          setSuccess(null);
        }
        return;
      }
      if (result.needsEmailConfirmation) {
        setSuccess(
          `Cuenta creada. Te hemos enviado un email a ${result.email} para confirmarla. Hasta entonces no has iniciado sesión. Si ya tenías cuenta, inicia sesión y activa Cliente desde Mi cuenta.`
        );
        return;
      }
      setSuccess('Cuenta creada e iniciada sesión.');
      router.push(afterRegister);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft-lg sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-first" className="text-sm font-medium">
              Nombre
            </Label>
            <Input
              id="c-first"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="h-11"
              autoComplete="given-name"
              required
              disabled={busy}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-last" className="text-sm font-medium">
              Apellidos
            </Label>
            <Input
              id="c-last"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="h-11"
              autoComplete="family-name"
              required
              disabled={busy}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-phone" className="text-sm font-medium">
            Teléfono
          </Label>
          <Input
            id="c-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11"
            autoComplete="tel"
            placeholder="612 345 678"
            required
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-email" className="text-sm font-medium">
            Email
          </Label>
          <Input
            id="c-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
            autoComplete="email"
            required
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-pass" className="text-sm font-medium">
            Contraseña
          </Label>
          <Input
            id="c-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-pass2" className="text-sm font-medium">
            Confirmar contraseña
          </Label>
          <Input
            id="c-pass2"
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="h-11"
            autoComplete="new-password"
            required
            minLength={8}
            disabled={busy}
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
        {success ? (
          <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900">
            {success}
          </p>
        ) : null}

        <Button
          type="submit"
          className="h-11 w-full gap-1.5"
          size="lg"
          disabled={busy}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creando cuenta…
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Crear cuenta
            </>
          )}
        </Button>

      </form>

      <p className="relative z-10 mt-4 text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <CustomerAuthLink
          href={loginHref}
          className="inline min-h-0 font-medium text-primary hover:underline"
        >
          Iniciar sesión
        </CustomerAuthLink>
      </p>
    </div>
  );
}
