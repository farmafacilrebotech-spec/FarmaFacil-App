'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';

/**
 * PharmacyLogo — per-pharmacy brand identity.
 *
 * Displays a pharmacy's logo image when available, or a colored
 * initials fallback when no logo has been uploaded yet.
 *
 * In the future, `logoUrl` and `logoColor` will come from the database.
 * Until then, they are passed from mock data.
 */

interface PharmacyLogoProps {
  name: string;
  logoUrl?: string | null;
  logoColor: string;
  size?: number;
  className?: string;
  rounded?: 'lg' | 'xl' | '2xl' | 'full';
}

const roundedMap = {
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full',
};

export function PharmacyLogo({
  name,
  logoUrl,
  logoColor,
  size = 40,
  className,
  rounded = 'lg',
}: PharmacyLogoProps) {
  const [imgError, setImgError] = React.useState(false);
  const showImage = logoUrl && !imgError;
  const fontSize = Math.max(10, size * 0.36);

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden',
        roundedMap[rounded],
        className
      )}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        <Image
          src={logoUrl}
          alt={`Logo de ${name}`}
          width={size}
          height={size}
          className="h-full w-full object-contain"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-semibold text-white"
          style={{ backgroundColor: logoColor, fontSize }}
          aria-label={`Logo de ${name}`}
        >
          {initials(name)}
        </div>
      )}
    </div>
  );
}
