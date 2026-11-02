'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { normalizeCustomerLoginIdentifier } from '@/lib/customer/validation';
import { CustomerAuthLink } from '@/components/customer/customer-auth-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CustomerLoginForm({
  publicId,
  redirectTo,
  title = 'Iniciar sesión',
  subtitle,
}: {
  publicId?: string;
  redirectTo?: string;
  title?: string;
  subtitle?: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const afterLogin =
    redirectTo ||
    (publicId ? `/e/${publicId}/cuenta` : '/cuenta/mis-farmacias');
  const registerHref = publicId
    ? `/e/${publicId}/cuenta/registro`
    : '/cuenta/registro';
  /** Retorno al área cliente tras recuperación (soportado por forgot-password). */
  const forgotHref = publicId
    ? `/forgot-password?next=${encodeURIComponent(`/e/${publicId}/cuenta`)}`
    : `/forgot-password?next=${encodeURIComponent('/cuenta')}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = normalizeCustomerLoginIdentifier(email);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: parsed.email,
        password,
      });
      if (authError) {
        const m = authError.message.toLowerCase();
        if (m.includes('email not confirmed')) {
          setError(
            'Debes confirmar tu email antes de acceder. Revisa tu bandeja de entrada.'
          );
          return;
        }
        if (m.includes('invalid')) {
          setError('Email o contraseña incorrectos.');
          return;
        }
        setError('No se ha podido iniciar sesión.');
        return;
      }
      router.push(afterLogin);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 rounded-2xl border border-border bg-card p-6 shadow-soft-lg sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cl-email" className="text-sm font-medium">
            Email
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="cl-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.es"
              className="h-11 pl-9"
              autoComplete="email"
              required
              disabled={busy}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Acceso de cliente con email y contraseña. El teléfono del perfil no
            sustituye al email para iniciar sesión.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cl-pass" className="text-sm font-medium">
            Contraseña
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="cl-pass"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 pl-9 pr-10"
              autoComplete="current-password"
              required
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
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
          {/* Fuera de la fila del Label: evita que el toque se asocie al input. */}
          <div className="flex justify-end">
            <CustomerAuthLink
              href={forgotHref}
              className="px-1 text-xs font-medium text-primary hover:text-primary-hover hover:underline"
            >
              ¿Has olvidado tu contraseña?
            </CustomerAuthLink>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
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
              Entrando…
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Iniciar sesión
            </>
          )}
        </Button>
      </form>

      {/* Fuera del <form>: navegación de documento fiable en móvil. */}
      <p className="relative z-10 mt-4 text-center text-sm text-muted-foreground">
        ¿No tienes cuenta?{' '}
        <CustomerAuthLink
          href={registerHref}
          className="inline font-medium text-primary hover:underline min-h-0"
        >
          Crear cuenta
        </CustomerAuthLink>
      </p>
    </div>
  );
}
