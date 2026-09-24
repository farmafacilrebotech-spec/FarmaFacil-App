'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { resetPasswordAction } from '@/app/(auth)/reset-password/actions';

function getStrength(pw: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: 'Muy débil', color: 'bg-destructive' },
    { label: 'Débil', color: 'bg-warning' },
    { label: 'Aceptable', color: 'bg-primary' },
    { label: 'Buena', color: 'bg-success' },
    { label: 'Excelente', color: 'bg-success' },
  ];
  return { score, ...levels[score] };
}

export default function ResetPasswordPage() {
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [doneMessage, setDoneMessage] = React.useState<string | null>(null);

  const strength = getStrength(password);
  const match = confirm.length > 0 && password === confirm;
  const canSubmit = password.length >= 8 && match && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!match) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    const result = await resetPasswordAction({
      password,
      confirmPassword: confirm,
    });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setDoneMessage(result.message);
    // Hard navigation: evita reutilizar estado/cookies en el cliente.
    window.setTimeout(() => {
      window.location.replace('/login');
    }, 1200);
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-8 flex justify-center">
        <BrandLogo size={44} showTagline />
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
        {doneMessage ? (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-foreground">
              Contraseña actualizada
            </h2>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              {doneMessage}
            </p>
            <Button asChild className="mt-6 gap-1.5">
              <Link href="/login">Ir a iniciar sesión</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Establecer nueva contraseña
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Crea una contraseña segura para tu cuenta
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">
                  Nueva contraseña
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="••••••••"
                    className="h-11 pl-9 pr-10"
                    required
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Mostrar contraseña"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-1.5 flex-1 rounded-full transition-colors',
                            i < strength.score ? strength.color : 'bg-muted'
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Seguridad:{' '}
                      <span className="font-medium">{strength.label}</span>
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-sm font-medium">
                  Confirmar contraseña
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      setError('');
                    }}
                    placeholder="••••••••"
                    className="h-11 pl-9 pr-10"
                    required
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Mostrar contraseña"
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {confirm.length > 0 && !match && (
                  <p className="text-xs text-destructive">
                    Las contraseñas no coinciden
                  </p>
                )}
                {confirm.length > 0 && match && (
                  <p className="text-xs text-success">
                    Las contraseñas coinciden
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button
                type="submit"
                className="h-11 w-full gap-1.5"
                size="lg"
                disabled={!canSubmit}
              >
                <ShieldCheck className="h-4 w-4" />
                {loading ? 'Guardando…' : 'Restablecer contraseña'}
              </Button>
            </form>
          </>
        )}
      </div>

      {!doneMessage && (
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a iniciar sesión
          </Link>
        </div>
      )}
    </div>
  );
}
