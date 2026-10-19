'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  QrCode,
  Search,
  ShoppingCart,
  X,
} from 'lucide-react';

import { BrandLogo } from '@/components/brand';
import { ScannableQr } from '@/components/kiosk/scannable-qr';
import type { KioskHomeContext } from '@/lib/kiosk/home-context';
import { cn } from '@/lib/utils';

type Tile =
  | {
      id: 'catalog' | 'assistant' | 'cart';
      title: string;
      subtitle: string;
      href: string;
      icon: React.ComponentType<{ className?: string }>;
    }
  | {
      id: 'account';
      title: string;
      subtitle: string;
      icon: React.ComponentType<{ className?: string }>;
    };

const TILES: Tile[] = [
  {
    id: 'catalog',
    title: 'Buscar producto',
    subtitle: 'Buscador inteligente',
    href: '/k/catalogo',
    icon: Search,
  },
  {
    id: 'assistant',
    title: 'Asistente IA',
    subtitle: 'Consulta farmacéutica',
    href: '/k/asistente',
    icon: MessageCircle,
  },
  {
    id: 'account',
    title: 'Accede a tu cuenta',
    subtitle: 'Escanea con tu móvil',
    icon: QrCode,
  },
  {
    id: 'cart',
    title: 'Mi carrito',
    subtitle: 'Imprimir ticket',
    href: '/k/carrito',
    icon: ShoppingCart,
  },
];

export function KioskWelcomeScreen({ home }: { home: KioskHomeContext }) {
  const [showQr, setShowQr] = React.useState(false);

  React.useEffect(() => {
    if (!showQr) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowQr(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showQr]);

  return (
    <div className="relative flex min-h-screen flex-col bg-[#2EC4C7] px-5 pb-10 pt-8 sm:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center">
        <BrandLogo size={120} className="drop-shadow-sm" />

        <h1 className="mt-6 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Bienvenido a FarmaFácil
        </h1>
        <p className="mt-2 text-center text-lg font-medium text-white/90 sm:text-xl">
          ¿Qué necesitas hoy?
        </p>
        {home.pharmacyName ? (
          <p className="mt-1 text-center text-sm text-white/75">
            {home.pharmacyName}
          </p>
        ) : null}

        <div className="mt-8 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          {TILES.map((tile) => {
            const Icon = tile.icon;
            const body = (
              <>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2EC4C7]/15 text-[#1a9a9d]">
                  <Icon className="h-7 w-7" aria-hidden />
                </span>
                <span className="mt-4 text-left">
                  <span className="block text-xl font-semibold text-slate-900">
                    {tile.title}
                  </span>
                  <span className="mt-1 block text-sm text-slate-500">
                    {tile.subtitle}
                  </span>
                </span>
              </>
            );

            const className = cn(
              'flex min-h-[148px] flex-col items-start rounded-3xl bg-white p-6 text-left shadow-lg shadow-black/10 transition',
              'active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70'
            );

            if (tile.id === 'account') {
              return (
                <button
                  key={tile.id}
                  type="button"
                  className={className}
                  onClick={() => setShowQr(true)}
                >
                  {body}
                </button>
              );
            }

            return (
              <Link key={tile.id} href={tile.href} className={className}>
                {body}
              </Link>
            );
          })}
        </div>
      </div>

      {showQr ? (
        <PharmacyAccountQrModal
          pharmacyName={home.pharmacyName}
          entrypoint={home.entrypoint}
          lookupUnavailable={home.entrypointLookupUnavailable}
          onClose={() => setShowQr(false)}
        />
      ) : null}
    </div>
  );
}

function PharmacyAccountQrModal({
  pharmacyName,
  entrypoint,
  lookupUnavailable,
  onClose,
}: {
  pharmacyName: string;
  entrypoint: KioskHomeContext['entrypoint'];
  lookupUnavailable: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kiosk-qr-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2EC4C7]/15 text-[#1a9a9d]">
            <QrCode className="h-6 w-6" aria-hidden />
          </span>
          <h2
            id="kiosk-qr-title"
            className="mt-4 text-2xl font-semibold text-slate-900"
          >
            {pharmacyName}
          </h2>
          <p className="mt-2 text-base text-slate-600">
            Escanea este código con tu móvil
          </p>

          <div className="mt-6 flex min-h-[280px] w-full flex-col items-center justify-center">
            {entrypoint ? (
              <>
                {/*
                  Preferimos QR generado desde public_id (URL pública).
                  qr_asset_path en Storage se usará cuando el alta de farmacias
                  publique el asset; no inventamos un path paralelo.
                */}
                <ScannableQr
                  value={entrypoint.publicUrl}
                  size={280}
                  label={`QR de ${pharmacyName}`}
                  className="rounded-2xl border border-slate-100"
                />
                <p className="mt-3 max-w-xs text-xs text-slate-400">
                  Este código no inicia sesión automáticamente. Abre la página
                  pública de la farmacia en tu móvil.
                </p>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-600">
                {lookupUnavailable ? (
                  <p>
                    El código QR de la farmacia aún no está disponible en este
                    entorno. Cuando el entrypoint esté provisionado, aparecerá
                    aquí.
                  </p>
                ) : (
                  <p>
                    Esta farmacia todavía no tiene un código QR de acceso
                    público activo. Puedes continuar usando el catálogo y el
                    carrito en el kiosko.
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-2xl bg-[#2EC4C7] px-6 py-4 text-base font-semibold text-white shadow-md active:scale-[0.99]"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
