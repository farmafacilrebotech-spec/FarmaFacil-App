'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { normalizeCustomerLoginIdentifier } from '@/lib/customer/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CustomerLoginForm({ publicId }: { publicId: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
      router.push(`/e/${publicId}/cuenta`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
    >
      <div className="space-y-1.5">
        <Label htmlFor="cl-email">Email</Label>
        <Input
          id="cl-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <p className="text-[11px] text-muted-foreground">
          El acceso es con email y contraseña (Supabase Auth). El teléfono del
          perfil no sustituye al email para iniciar sesión.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cl-pass">Contraseña</Label>
        <Input
          id="cl-pass"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Entrando…
          </>
        ) : (
          'Iniciar sesión'
        )}
      </Button>
      <div className="flex flex-col gap-2 text-center text-sm">
        <Link
          href={`/forgot-password?next=${encodeURIComponent(`/e/${publicId}/cuenta`)}`}
          className="text-primary hover:underline"
        >
          ¿Has olvidado tu contraseña?
        </Link>
        <Link
          href={`/e/${publicId}/cuenta/registro`}
          className="font-medium text-foreground hover:underline"
        >
          Crear cuenta
        </Link>
      </div>
    </form>
  );
}
