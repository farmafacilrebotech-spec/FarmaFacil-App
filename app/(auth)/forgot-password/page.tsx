'use client';

import * as React from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, CheckCircle2, Send } from 'lucide-react';

import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [sent, setSent] = React.useState(false);
  const [email, setEmail] = React.useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="animate-slide-up">
      <div className="mb-8 flex justify-center">
        <BrandLogo size={44} showTagline />
      </div>

      <div className="rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
        {!sent ? (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Recuperar contraseña
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Te enviaremos un enlace para restablecer tu contraseña
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

              <Button type="submit" className="h-11 w-full gap-1.5" size="lg">
                <Send className="h-4 w-4" /> Enviar enlace
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center py-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-foreground">
              Revisa tu correo
            </h2>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              Hemos enviado un enlace de recuperación a{' '}
              <span className="font-medium text-foreground">{email || 'tu email'}</span>.
              El enlace expira en 30 minutos.
            </p>
            <Button
              variant="outline"
              className="mt-6 gap-1.5"
              onClick={() => setSent(false)}
            >
              Volver a enviar
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
