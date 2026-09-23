'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, LogIn } from 'lucide-react';

import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { createClient } from '@/lib/supabase/client';
import { resolvePostLoginDestinationAction } from '@/app/auth/continue/actions';

function mapAuthError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes('invalid login credentials') ||
    m.includes('invalid credentials')
  ) {
    return 'Email o contraseña incorrectos.';
  }
  if (m.includes('email not confirmed')) {
    return 'Debes confirmar tu email antes de acceder.';
  }
  if (m.includes('too many requests')) {
    return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  }
  return 'No se ha podido iniciar sesión. Inténtalo de nuevo.';
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = React.useState(false);
  const hintParam = searchParams.get('hint');
  const emailParam = searchParams.get('email');
  const [email, setEmail] = React.useState(emailParam?.trim() ?? '');
  const [password, setPassword] = React.useState('');
  const [remember, setRemember] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (emailParam?.trim()) {
      setEmail(emailParam.trim());
    }
  }, [emailParam]);

  const errorParam = searchParams.get('error');
  const callbackErrorMessage =
    errorParam === 'missing_code'
      ? 'El enlace de invitación no es válido o está incompleto. Solicita una nueva invitación.'
      : errorParam === 'auth_callback'
        ? 'No se ha podido validar el enlace de acceso. Solicita una nueva invitación o inténtalo de nuevo.'
        : errorParam === 'forbidden'
          ? 'Tu cuenta no tiene acceso autorizado a FarmaFácil.'
          : null;

  const inviteHint =
    hintParam === 'invite'
      ? emailParam?.trim()
        ? `Esta invitación es para ${emailParam.trim()}. Inicia sesión con esa cuenta para verla y aceptarla. No es un restablecimiento de contraseña.`
        : 'Inicia sesión con la cuenta a la que se envió la invitación para verla y aceptarla. No es un restablecimiento de contraseña.'
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        // Diagnóstico temporal (solo desarrollo). No registra secretos.
        if (process.env.NODE_ENV === 'development') {
          console.error('[auth/login] signInWithPassword error', {
            message: signInError.message,
            status: (signInError as { status?: number }).status,
            code: (signInError as { code?: string }).code,
            name: signInError.name,
          });
        }
        setError(mapAuthError(signInError.message));
        return;
      }

      // Destino según resolveAppAccess (no hardcodear /dashboard).
      // Solo respetamos ?next= hacia rutas internas de farmacia o continue.
      const next = searchParams.get('next');
      const safeNext =
        next &&
        next.startsWith('/') &&
        !next.startsWith('//') &&
        (next.startsWith('/f/') ||
          next === '/first-access' ||
          next === '/auth/continue' ||
          next === '/auth/select-pharmacy' ||
          next === '/auth/invitations')
          ? next
          : null;

      if (safeNext) {
        router.replace(safeNext);
        router.refresh();
        return;
      }

      const destination = await resolvePostLoginDestinationAction();
      if (!destination.ok) {
        setError(destination.error);
        return;
      }

      router.replace(destination.path);
      router.refresh();
    } catch (err) {
      // Diagnóstico temporal (solo desarrollo).
      if (process.env.NODE_ENV === 'development') {
        const e = err as { message?: string; name?: string; status?: number };
        console.error('[auth/login] unexpected exception', {
          message: e?.message ?? String(err),
          name: e?.name,
          status: e?.status,
        });
      }
      setError('No se ha podido iniciar sesión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-8 flex justify-center">
        <BrandLogo size={44} showTagline />
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Bienvenido de nuevo
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Accede a tu panel de gestión de FarmaFácil
          </p>
        </div>

        {inviteHint ? (
          <div
            role="status"
            className="mb-4 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm text-foreground"
          >
            {inviteHint}
          </div>
        ) : null}

        {(callbackErrorMessage || error) && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error ?? callbackErrorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@farmafacil.es"
                className="h-11 pl-9"
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            {/* flex-wrap + gap: evita solape Label/enlace si el motor tipográfico
                ensancha el texto (Safari) dentro del card max-w-[420px]. */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <Label htmlFor="password" className="shrink-0 text-sm font-medium">
                Contraseña
              </Label>
              <Link
                href="/forgot-password"
                className="shrink-0 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
              >
                ¿Has olvidado tu contraseña?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 pl-9 pr-10"
                autoComplete="current-password"
                required
                disabled={loading}
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
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="remember"
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
              disabled={loading}
            />
            <Label htmlFor="remember" className="text-sm text-muted-foreground">
              Recordarme en este dispositivo
            </Label>
          </div>

          <Button
            type="submit"
            className="h-11 w-full gap-1.5"
            size="lg"
            disabled={loading}
          >
            <LogIn className="h-4 w-4" />
            {loading ? 'Accediendo…' : 'Acceder'}
          </Button>
        </form>
      </div>

    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="animate-slide-up">
          <div className="mb-8 flex justify-center">
            <BrandLogo size={44} showTagline />
          </div>
          <div className="rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
            <p className="text-center text-sm text-muted-foreground">
              Cargando…
            </p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
