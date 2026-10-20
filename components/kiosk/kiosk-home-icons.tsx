import * as React from 'react';
import Image from 'next/image';

import { cn } from '@/lib/utils';

type IconProps = {
  className?: string;
  title?: string;
};

const ICON_SIZE = 632;

/**
 * Iconos PNG transparentes de la bienvenida del kiosko.
 * No sustituyen el QR dinámico de la farmacia (modal).
 */
function KioskPngIcon({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={title}
      width={ICON_SIZE}
      height={ICON_SIZE}
      className={cn('h-full w-full object-contain', className)}
      sizes="(min-width: 700px) and (min-height: 1200px) 150px, (min-width: 600px) 120px, 90px"
      priority
    />
  );
}

export function KioskIconSearch({
  className,
  title = 'Buscar producto',
}: IconProps) {
  return (
    <KioskPngIcon
      src="/images/kiosk/kiosk-search.png"
      title={title}
      className={className}
    />
  );
}

export function KioskIconAssistant({
  className,
  title = 'Asistente IA',
}: IconProps) {
  return (
    <KioskPngIcon
      src="/images/kiosk/kiosk-ai.png"
      title={title}
      className={className}
    />
  );
}

export function KioskIconQr({
  className,
  title = 'Accede a tu cuenta',
}: IconProps) {
  return (
    <KioskPngIcon
      src="/images/kiosk/kiosk-qr.png"
      title={title}
      className={className}
    />
  );
}

export function KioskIconCart({
  className,
  title = 'Mi carrito',
}: IconProps) {
  return (
    <KioskPngIcon
      src="/images/kiosk/kiosk-cart.png"
      title={title}
      className={className}
    />
  );
}

export function KioskTileArrow({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        // Siempre círculo: w===h, aspect-square, sin grow, sin width 100%.
        'inline-flex aspect-square h-12 w-12 shrink-0 grow-0 items-center justify-center rounded-full',
        'bg-[#2EC4C7] text-white shadow-md shadow-[#1a9a9d]/35',
        className
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none h-5 w-5 shrink-0"
        fill="none"
      >
        <path
          d="M5 12h12m0 0-5-5m5 5-5 5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
