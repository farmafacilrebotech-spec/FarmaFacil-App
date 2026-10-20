'use client';

import * as React from 'react';
import Link from 'next/link';
import { Caveat } from 'next/font/google';
import { QrCode, X } from 'lucide-react';

import { BrandLogo } from '@/components/brand';
import {
  KioskIconAssistant,
  KioskIconCart,
  KioskIconQr,
  KioskIconSearch,
  KioskTileArrow,
} from '@/components/kiosk/kiosk-home-icons';
import { ScannableQr } from '@/components/kiosk/scannable-qr';
import type { KioskHomeContext } from '@/lib/kiosk/home-context';
import { cn } from '@/lib/utils';

const sloganFont = Caveat({
  subsets: ['latin'],
  weight: ['600'],
  display: 'swap',
});

type Tile = {
  id: 'catalog' | 'assistant' | 'account' | 'cart';
  title: string;
  subtitle: string;
  href?: string;
  Icon: React.ComponentType<{ className?: string; title?: string }>;
};

const TILES: Tile[] = [
  {
    id: 'catalog',
    title: 'Buscar producto',
    subtitle: 'Explora nuestro catálogo de productos',
    href: '/k/catalogo',
    Icon: KioskIconSearch,
  },
  {
    id: 'assistant',
    title: 'Asistente IA',
    subtitle: 'Consulta tus dudas farmacéuticas',
    href: '/k/asistente',
    Icon: KioskIconAssistant,
  },
  {
    id: 'account',
    title: 'Accede a tu cuenta',
    subtitle: 'Escanea el código QR con tu móvil',
    Icon: KioskIconQr,
  },
  {
    id: 'cart',
    title: 'Mi carrito',
    subtitle: 'Revisa tu pedido e imprime tu ticket',
    href: '/k/carrito',
    Icon: KioskIconCart,
  },
];

/**
 * Bienvenida kiosko — composición del iPhone, tamaños moderados.
 * Centra el bloque en pantallas altas (sin estirar el interior de las tarjetas).
 * Iconos/botones: rem + vw (no vh exclusivos). Sin overflow:hidden de recorte.
 */
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
    <div
      className={cn(
        'relative flex min-h-[100dvh] flex-col justify-center bg-[#2EC4C7]',
        // Padding superior suficiente para no recortar el logo (safe area + aire).
        'px-5 pb-6 pt-[max(1.5rem,env(safe-area-inset-top,0px))] sm:px-8 sm:pb-8 sm:pt-8',
        // Kiosko portrait grande: un poco más de aire, sin forzar recorte.
        '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:px-[clamp(1.5rem,4vw,2.75rem)]',
        '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:py-[clamp(1.25rem,3vw,2rem)]'
      )}
    >
      <DecorativeCross className="pointer-events-none absolute -left-10 -top-8 h-[42vw] max-h-[22rem] w-[42vw] max-w-[22rem] text-white/[0.10]" />
      <DecorativeCross className="pointer-events-none absolute -bottom-12 -right-10 h-[48vw] max-h-[26rem] w-[48vw] max-w-[26rem] rotate-12 text-white/[0.09]" />

      <div
        className={cn(
          'relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center',
          '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:max-w-[min(48rem,90vw)]'
        )}
      >
        <header className="flex shrink-0 flex-col items-center text-center">
          {/*
            PNG oficial 709×711. Visual ~88–120 px móvil; hasta ~160 px kiosko.
            object-contain vía BrandLogo; sin scale ni recorte.
          */}
          <div
            className={cn(
              'w-[clamp(5.5rem,22vw,7.5rem)]',
              '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:900px)]:w-[clamp(6.5rem,14vw,9rem)]',
              '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1400px)]:w-[clamp(7.5rem,12vw,10rem)]'
            )}
          >
            <BrandLogo
              size={200}
              className="block w-full [&_img]:!h-auto [&_img]:!w-full [&_img]:object-contain"
            />
          </div>

          <h1
            className={cn(
              'mt-4 text-3xl font-bold tracking-tight text-white sm:mt-5 sm:text-4xl',
              '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:mt-5',
              '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:text-[clamp(2rem,4.5vw,2.75rem)]'
            )}
          >
            Bienvenido a FarmaFácil
          </h1>
          <p
            className={cn(
              'mt-2 text-lg font-medium text-white/92 sm:text-xl',
              '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:text-[clamp(1.125rem,2.8vw,1.5rem)]'
            )}
          >
            ¿Qué necesitas hoy?
          </p>
          {home.pharmacyName ? (
            <p
              className={cn(
                'mt-1 text-sm text-white/75',
                '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:text-base'
              )}
            >
              {home.pharmacyName}
            </p>
          ) : null}
        </header>

        <div
          className={cn(
            'mt-7 grid w-full grid-cols-2 gap-3 sm:mt-8 sm:gap-5',
            '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:mt-8',
            '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:gap-[clamp(1rem,2.2vw,1.35rem)]'
          )}
        >
          {TILES.map((tile) => {
            const { Icon } = tile;
            const body = (
              <span className="flex w-full flex-col items-center justify-center gap-3 sm:gap-3.5">
                {/* Icono: rem + vw, aspect 1/1, object-contain, sin overflow */}
                <span
                  className={cn(
                    'relative aspect-square shrink-0 overflow-hidden',
                    // Móvil 65–90 px
                    'w-[clamp(4.0625rem,18vw,5.625rem)]',
                    // Tablet / portrait medio 90–120 px
                    '[@media(orientation:portrait)_and_(min-width:600px)_and_(min-height:800px)]:w-[clamp(5.625rem,14vw,7.5rem)]',
                    // Kiosko grande 110–150 px
                    '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1200px)]:w-[clamp(6.875rem,11vw,9.375rem)]'
                  )}
                >
                  <Icon
                    className="!h-full !w-full object-contain"
                    title={tile.title}
                  />
                </span>

                <span className="flex w-full max-w-[17ch] flex-col items-center gap-1 px-0.5 text-center sm:max-w-[19ch]">
                  <span
                    className={cn(
                      'line-clamp-2 text-base font-bold leading-snug text-slate-900 sm:text-xl',
                      '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1200px)]:text-[clamp(1.2rem,2.6vw,1.65rem)]'
                    )}
                  >
                    {tile.title}
                  </span>
                  <span
                    className={cn(
                      'line-clamp-3 text-xs leading-snug text-slate-500 sm:text-sm',
                      '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1200px)]:text-[clamp(0.875rem,2vw,1.0625rem)]'
                    )}
                  >
                    {tile.subtitle}
                  </span>
                </span>

                {/* Botón siempre circular: w=h, aspect-square, shrink-0, sin grow */}
                <KioskTileArrow
                  className={cn(
                    'h-11 w-11 sm:h-12 sm:w-12',
                    '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1200px)]:h-[3.5rem]',
                    '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1200px)]:w-[3.5rem]'
                  )}
                />
              </span>
            );

            const className = cn(
              // Altura mínima común > contenido máximo (icono+texto+botón) → tarjetas iguales.
              'flex h-full min-h-[12.25rem] flex-col items-center justify-center rounded-[1.75rem] bg-white p-4 text-center shadow-lg shadow-black/10 sm:min-h-[13.25rem] sm:p-5',
              'transition active:scale-[0.985] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70',
              '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:min-h-[14.5rem]',
              '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:rounded-[2rem]',
              '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:p-5',
              '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:shadow-xl',
              '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:shadow-black/12'
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
              <Link key={tile.id} href={tile.href!} className={className}>
                {body}
              </Link>
            );
          })}
        </div>

        <p
          className={cn(
            sloganFont.className,
            'mt-6 hidden text-center text-2xl leading-none text-white/95',
            '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:mt-8',
            '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:block',
            '[@media(orientation:portrait)_and_(min-width:700px)_and_(min-height:1100px)]:text-[clamp(1.5rem,3.2vw,2.125rem)]'
          )}
        >
          Tu farmacia, más cerca de ti
          <span
            className="mx-auto mt-1 block h-[2px] w-[9.5rem] rounded-full bg-white/80"
            aria-hidden
          />
        </p>
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

function DecorativeCross({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      fill="none"
      aria-hidden
    >
      <path
        d="M48 18h24v30h30v24H72v30H48V72H18V48h30V18Z"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinejoin="round"
      />
    </svg>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm lg:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kiosk-qr-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8 lg:max-w-lg lg:p-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:h-14 lg:w-14"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5 lg:h-6 lg:w-6" />
        </button>

        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2EC4C7]/15 text-[#1a9a9d] lg:h-16 lg:w-16">
            <QrCode className="h-6 w-6 lg:h-8 lg:w-8" aria-hidden />
          </span>
          <h2
            id="kiosk-qr-title"
            className="mt-4 text-2xl font-semibold text-slate-900 lg:text-3xl"
          >
            {pharmacyName}
          </h2>
          <p className="mt-2 text-base text-slate-600 lg:text-lg">
            Escanea este código con tu móvil
          </p>

          <div className="mt-6 flex min-h-[280px] w-full flex-col items-center justify-center lg:min-h-[320px]">
            {entrypoint ? (
              <>
                <ScannableQr
                  value={entrypoint.publicUrl}
                  size={280}
                  label={`QR de ${pharmacyName}`}
                  className="rounded-2xl border border-slate-100"
                />
                <p className="mt-3 max-w-xs text-xs text-slate-400 lg:text-sm">
                  Este código no inicia sesión automáticamente. Abre la página
                  pública de la farmacia en tu móvil.
                </p>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-600 lg:text-base">
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
            className="mt-6 w-full rounded-2xl bg-[#2EC4C7] px-6 py-4 text-base font-semibold text-white shadow-md active:scale-[0.99] lg:py-5 lg:text-lg"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
