'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, ShieldCheck, Check } from 'lucide-react';

import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export default function FirstAccessPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = React.useState(false);

  const match = confirm.length > 0 && password === confirm;
  const canSubmit = password.length >= 8 && match && acceptTerms && acceptPrivacy;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push('/dashboard');
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-8 flex justify-center">
        <BrandLogo size={44} showTagline />
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Primer acceso
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Configura tu contraseña para empezar a usar FarmaFácil
          </p>
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
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Mostrar contraseña"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                required
              />
            </div>
            {confirm.length > 0 && !match && (
              <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="terms"
                checked={acceptTerms}
                onCheckedChange={(v) => setAcceptTerms(v === true)}
                className="mt-0.5"
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

          <Button
            type="submit"
            className="h-11 w-full gap-1.5"
            size="lg"
            disabled={!canSubmit}
          >
            <Check className="h-4 w-4" /> Finalizar acceso
          </Button>
        </form>
      </div>
    </div>
  );
}
