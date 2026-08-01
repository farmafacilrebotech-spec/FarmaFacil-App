'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, Lock, LogIn, ArrowRight } from 'lucide-react';

import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [remember, setRemember] = React.useState(true);

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
            Bienvenido de nuevo
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Accede a tu panel de gestión de FarmaFácil
          </p>
        </div>

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
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
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
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
            />
            <Label htmlFor="remember" className="text-sm text-muted-foreground">
              Recordarme en este dispositivo
            </Label>
          </div>

          <Button type="submit" className="h-11 w-full gap-1.5" size="lg">
            <LogIn className="h-4 w-4" /> Acceder
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
