'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * BrandLogo — identidad gráfica oficial FarmaFácil.
 *
 * Usa el logotipo oficial (PNG circular) sin redibujar ni aproximar.
 * - full: emblema completo (cruz + anillo + FARMAFÁCIL).
 * - mark: mismo emblema a tamaño reducido (sidebar colapsado, header).
 * - wordmark: solo texto tipográfico (casos excepcionales).
 *
 * Assets UI: farmafacil-logo-512.png / farmafacil-mark.png.
 * Esos PNG oficiales son cuadrados con fondo negro opaco fuera del aro;
 * no hay variante con transparencia real en las esquinas. Se aplica
 * recorte circular CSS (`rounded-full` + `overflow-hidden`) para ocultar
 * las esquinas sin alterar cruz, tipografía, texto ni aro plateado.
 *
 * El prop `clip` se acepta por compatibilidad con callers existentes;
 * el emblema siempre se muestra con recorte circular.
 */

type Variant = 'full' | 'mark' | 'wordmark';

interface BrandLogoProps {
  variant?: Variant;
  className?: string;
  /** Diámetro del emblema circular (px). */
  size?: number;
  /**
   * Etiqueta auxiliar bajo el emblema.
   * Por defecto «Panel de gestión» (acceso farmacia). No usar en cliente.
   */
  showTagline?: boolean;
  /**
   * @deprecated El emblema siempre se recorta en círculo.
   * Se acepta por compatibilidad con callers existentes.
   */
  clip?: 'none' | 'circle';
}

const LOGO_FULL = '/images/logos/farmafacil-logo-512.png';
const LOGO_MARK = '/images/logos/farmafacil-mark.png';

export function BrandLogo({
  variant = 'full',
  className,
  size = 36,
  showTagline = false,
  clip: _clip = 'none',
}: BrandLogoProps) {
  void _clip;

  if (variant === 'wordmark') {
    return (
      <span
        className={cn('font-semibold tracking-tight text-foreground', className)}
        style={{ fontSize: size * 0.42 }}
      >
        FarmaFácil
      </span>
    );
  }

  // Emblema grande (>96): PNG 512 completo. Mark en UI típica ≤96px.
  const src = variant === 'mark' || size <= 96 ? LOGO_MARK : LOGO_FULL;

  const emblem = (
    <span
      className="inline-flex shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      <Image
        src={src}
        alt="FarmaFácil"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        priority
        sizes={`${size}px`}
      />
    </span>
  );

  if (variant === 'mark' || !showTagline) {
    return <div className={cn('inline-flex', className)}>{emblem}</div>;
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 text-center',
        className
      )}
    >
      {emblem}
      <span
        className="font-medium tracking-tight text-muted-foreground"
        style={{ fontSize: Math.max(12, Math.round(size * 0.16)) }}
      >
        Panel de gestión
      </span>
    </div>
  );
}
