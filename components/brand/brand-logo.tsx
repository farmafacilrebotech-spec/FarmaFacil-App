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
 * Asset fuente UI: farmafacil-logo-512.png (448KB).
 * El PNG original (~952KB) se reserva fuera del render web habitual.
 *
 * No aplicar máscaras/recortes que corten el aro plateado, el nombre o la cruz.
 * El prop `clip` se ignora (compat); el asset se muestra completo con object-contain.
 */

type Variant = 'full' | 'mark' | 'wordmark';

interface BrandLogoProps {
  variant?: Variant;
  className?: string;
  /** Ancho del emblema; la altura respeta la proporción 709×711. */
  size?: number;
  /**
   * Etiqueta auxiliar bajo el emblema.
   * Por defecto «Panel de gestión» (acceso farmacia). No usar en cliente.
   */
  showTagline?: boolean;
  /**
   * @deprecated No recortar el logo. Se acepta por compatibilidad y se ignora.
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

  // Emblema grande (≥112): PNG 512 completo. Mark solo en UI pequeña.
  const src = variant === 'mark' || size <= 96 ? LOGO_MARK : LOGO_FULL;
  const width = size;
  const height = Math.round(size * (711 / 709));

  const emblem = (
    <Image
      src={src}
      alt="FarmaFácil"
      width={width}
      height={height}
      className="shrink-0 object-contain"
      priority
      sizes={`${size}px`}
    />
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
