'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { savePharmacyAction, unsavePharmacyAction } from '@/app/cuenta/actions';
import { writePendingSavePharmacy } from '@/lib/customer/pending-pharmacy';
import { Button } from '@/components/ui/button';

export function SavePharmacyButton({
  publicId,
  pharmacyName,
  initiallySaved,
  isAuthenticated,
  variant = 'default',
}: {
  publicId: string;
  pharmacyName: string;
  initiallySaved: boolean;
  isAuthenticated: boolean;
  variant?: 'default' | 'compact';
}) {
  const router = useRouter();
  const [saved, setSaved] = React.useState(initiallySaved);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSaved(initiallySaved);
  }, [initiallySaved]);

  async function onSave() {
    setError(null);
    setMessage(null);
    if (!isAuthenticated) {
      writePendingSavePharmacy({ publicId, pharmacyName });
      router.push(`/e/${publicId}/cuenta/entrar`);
      return;
    }
    setBusy(true);
    try {
      const result = await savePharmacyAction({ publicId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setMessage(result.message ?? 'Guardada.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onUnsave() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const result = await unsavePharmacyAction({ publicId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(false);
      setMessage(result.message ?? 'Eliminada de Mis farmacias.');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const compact = variant === 'compact';

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {saved ? (
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={
              compact
                ? 'text-xs text-emerald-700'
                : 'text-sm text-emerald-700'
            }
          >
            Guardada en Mis farmacias
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void onUnsave()}
            className="h-8 text-xs text-slate-500"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Quitar'}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant={compact ? 'outline' : 'secondary'}
          className={compact ? 'w-full sm:w-auto' : 'w-full'}
          disabled={busy}
          onClick={() => void onSave()}
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Guardando…
            </>
          ) : isAuthenticated ? (
            'Guardar en Mis farmacias'
          ) : (
            'Guardar en Mis farmacias'
          )}
        </Button>
      )}
      {!isAuthenticated && !saved ? (
        <p className="text-[11px] text-muted-foreground">
          Necesitas iniciar sesión o crear cuenta. Conservaremos esta farmacia
          para guardarla después.
        </p>
      ) : null}
      {message ? (
        <p className="text-xs text-emerald-700">{message}</p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
