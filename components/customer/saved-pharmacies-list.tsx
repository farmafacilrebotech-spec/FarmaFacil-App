'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { unsavePharmacyAction } from '@/app/cuenta/actions';
import type { SavedPharmacy } from '@/lib/customer/saved-pharmacies';
import { Button } from '@/components/ui/button';

export function SavedPharmaciesList({ items }: { items: SavedPharmacy[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onRemove(item: SavedPharmacy) {
    setError(null);
    setBusyId(item.id);
    try {
      const result = await unsavePharmacyAction({
        publicId: item.publicId,
        pharmacyId: item.pharmacyId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="text-base font-semibold text-[#0F2A2E]">
          Aún no tienes farmacias guardadas
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Escanea el código QR de tu farmacia (o abre el enlace que te hayan
          compartido). En la página de la farmacia o en su catálogo, pulsa
          «Guardar en Mis farmacias». Visitar el QR por sí solo no guarda
          ninguna relación.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <p className="font-medium text-[#0F2A2E]">{item.pharmacyName}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Guardada el{' '}
              {new Date(item.savedAt).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/e/${item.publicId}`}>Abrir farmacia</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/e/${item.publicId}/catalogo`}>Catálogo</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busyId === item.id}
                onClick={() => void onRemove(item)}
                className="text-slate-500"
              >
                {busyId === item.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  'Quitar'
                )}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Quitar una farmacia no elimina tu cuenta ni tus pedidos.
      </p>
    </div>
  );
}
