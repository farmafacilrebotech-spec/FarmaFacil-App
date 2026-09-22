'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, LogIn, ArrowRight } from 'lucide-react';

import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { createClient } from '@/lib/supabase/client';

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
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [remember, setRemember] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const forbidden = searchParams.get('error') === 'forbidden';

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

      const next = searchParams.get('next');
      const destination =
        next && next.startsWith('/') && !next.startsWith('//')
          ? next
          : '/dashboard';

      router.replace(destination);
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

        {(forbidden || error) && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {forbidden && !error
              ? 'Tu cuenta no tiene permiso de SuperAdmin de plataforma.'
              : error}
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

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          ¿No tienes acceso todavía?{' '}
          <Link
            href="/invite"
            className="inline-flex items-center gap-0.5 font-medium text-primary transition-colors hover:text-primary-hover"
          >
            Solicitar acceso <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </p>
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
