'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, TabletSmartphone } from 'lucide-react';

import { pairKioskDeviceAction } from '@/app/f/[pharmacyId]/dispositivos/actions';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Emparejamiento público de tablet. Sin login de usuario.
 * La sesión de dispositivo queda en cookie HttpOnly.
 */
export default function KioskPairPage() {
  const router = useRouter();
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await pairKioskDeviceAction({
      code,
      displayName: name || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace('/k');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <BrandLogo size={96} showTagline />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <TabletSmartphone className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-center text-xl font-semibold text-foreground">
          Vincular tablet kiosko
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Introduce el código de un solo uso generado en el panel de la farmacia.
          No uses esta pantalla para acceder al dashboard.
        </p>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="kiosk-code">Código</Label>
            <Input
              id="kiosk-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="XXXX-XXXX"
              autoComplete="one-time-code"
              className="h-12 text-center font-mono text-lg tracking-widest"
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kiosk-name">Nombre del dispositivo (opcional)</Label>
            <Input
              id="kiosk-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mostrador 1"
              disabled={submitting}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={submitting || code.trim().length < 6}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Vinculando…
              </>
            ) : (
              'Vincular'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
