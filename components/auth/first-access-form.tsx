'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, Check, Loader2, ShieldCheck } from 'lucide-react';

import { completeFirstAccessAction } from '@/app/(auth)/first-access/actions';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export function FirstAccessForm({
  displayName,
  email,
}: {
  displayName: string | null;
  email: string;
}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const match = confirm.length > 0 && password === confirm;
  const canSubmit =
    password.length >= 8 &&
    match &&
    acceptTerms &&
    acceptPrivacy &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);

    try {
      const result = await completeFirstAccessAction({
        password,
        confirmPassword: confirm,
      });

      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      // Sesión intacta → entorno de la farmacia (sin signOut).
      router.replace(result.redirectTo);
      router.refresh();
    } catch {
      setError('No se ha podido completar el acceso. Inténtalo de nuevo.');
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-8 flex justify-center">
        <BrandLogo size={44} showTagline />
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Primer acceso
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {displayName
              ? `Hola, ${displayName}. Configura tu contraseña para FarmaFácil.`
              : 'Configura tu contraseña para empezar a usar FarmaFácil.'}
          </p>
          {email ? (
            <p className="mt-1 text-xs text-muted-foreground">{email}</p>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="h-11 pl-9 pr-10"
                autoComplete="new-password"
                required
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={
                  showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                }
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm" className="text-sm font-medium">
              Confirmar contraseña
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                className="h-11 pl-9"
                autoComplete="new-password"
                required
                disabled={submitting}
              />
            </div>
            {confirm.length > 0 && !match && (
              <p className="text-xs text-destructive">
                Las contraseñas no coinciden
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(v) => setAcceptTerms(v === true)}
                className="mt-0.5"
                disabled={submitting}
              />
              <Label htmlFor="terms" className="text-sm text-muted-foreground">
                Acepto los{' '}
                <span className="font-medium text-primary">
                  términos y condiciones
                </span>{' '}
                del servicio
              </Label>
            </div>
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="privacy"
                checked={acceptPrivacy}
                onCheckedChange={(v) => setAcceptPrivacy(v === true)}
                className="mt-0.5"
                disabled={submitting}
              />
              <Label htmlFor="privacy" className="text-sm text-muted-foreground">
                Acepto la{' '}
                <span className="font-medium text-primary">
                  política de privacidad
                </span>{' '}
                y el tratamiento de datos
              </Label>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="h-11 w-full gap-1.5"
            size="lg"
            disabled={!canSubmit}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Finalizar acceso
          </Button>
        </form>
      </div>
    </div>
  );
}

export function FirstAccessNoSession() {
  return (
    <div className="animate-slide-up">
      <div className="mb-8 flex justify-center">
        <BrandLogo size={44} showTagline />
      </div>
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-soft-lg">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Enlace de invitación requerido
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Para completar tu primer acceso, abre el enlace que recibiste por
          email. Si el enlace ha caducado, pide una nueva invitación a FarmaFácil.
        </p>
        <Button asChild className="mt-6 w-full" variant="outline">
          <Link href="/login">Ir al inicio de sesión</Link>
        </Button>
      </div>
    </div>
  );
}
