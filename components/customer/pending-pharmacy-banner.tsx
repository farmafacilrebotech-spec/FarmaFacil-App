'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { savePharmacyAction } from '@/app/cuenta/actions';
import {
  clearPendingSavePharmacy,
  readPendingSavePharmacy,
} from '@/lib/customer/pending-pharmacy';
import { Button } from '@/components/ui/button';

/**
 * Tras login/registro: ofrece guardar la farmacia conservada (acción consciente).
 */
export function PendingPharmacyBanner() {
  const router = useRouter();
  const [pending, setPending] = React.useState<{
    publicId: string;
    pharmacyName?: string;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPending(readPendingSavePharmacy());
  }, []);

  if (!pending) return null;

  async function onConfirm() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const result = await savePharmacyAction({ publicId: pending.publicId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      clearPendingSavePharmacy();
      setPending(null);
      router.push('/cuenta/mis-farmacias');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function onDismiss() {
    clearPendingSavePharmacy();
    setPending(null);
  }

  return (
    <div className="rounded-2xl border border-[#2EC4C7]/40 bg-[#2EC4C7]/10 p-4 text-sm">
      <p className="font-medium text-[#0F2A2E]">
        ¿Guardar{' '}
        {pending.pharmacyName
          ? `«${pending.pharmacyName}»`
          : 'esta farmacia'}{' '}
        en Mis farmacias?
      </p>
      <p className="mt-1 text-xs text-slate-600">
        La conservamos mientras iniciabas sesión. Solo se guarda si confirmas.
      </p>
      {error ? (
        <p className="mt-2 text-xs text-destructive">{error}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void onConfirm()}>
          {busy ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              Guardando…
            </>
          ) : (
            'Sí, guardar'
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onDismiss}
        >
          Ahora no
        </Button>
      </div>
    </div>
  );
}
