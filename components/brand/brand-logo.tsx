'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * BrandLogo — FarmaFácil global brand identity.
 *
 * Renders the official FarmaFácil logo. Uses the JPEG asset when available
 * and falls back to a bundled SVG mark so the project always renders
 * correctly even before the final brand assets are placed.
 *
 * To swap the official image later, replace the file at:
 *   public/images/logos/farmafacil-logo.jpeg
 * …or point `src` to an SVG. No screen changes required.
 */

type Variant = 'full' | 'mark' | 'wordmark';

interface BrandLogoProps {
  variant?: Variant;
  className?: string;
  size?: number;
  showTagline?: boolean;
}

// Path to the official JPEG logo (replace this file to update branding globally).
const LOGO_JPEG = '/images/logos/farmafacil-logo.jpeg';
// Bundled SVG fallbacks.
const MARK_SVG = '/images/logos/farmafacil-mark.svg';
const FULL_SVG = '/images/logos/farmafacil-logo-full.svg';

export function BrandLogo({
  variant = 'full',
  className,
  size = 36,
  showTagline = false,
}: BrandLogoProps) {
  const [imgError, setImgError] = React.useState(false);

  // --- Mark only (icon) ---
  if (variant === 'mark') {
    if (!imgError) {
      return (
        <Image
          src={LOGO_JPEG}
          alt="FarmaFácil"
          width={size}
          height={size}
          className={cn('rounded-lg object-contain', className)}
          onError={() => setImgError(true)}
          priority
        />
      );
    }
    return (
      <Image
        src={MARK_SVG}
        alt="FarmaFácil"
        width={size}
        height={size}
        className={cn('rounded-lg', className)}
        priority
      />
    );
  }

  // --- Wordmark only (text) ---
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

  // --- Full (mark + wordmark) ---
  const markSize = size;
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {imgError ? (
        <Image
          src={MARK_SVG}
          alt="FarmaFácil"
          width={markSize}
          height={markSize}
          className="shrink-0 rounded-lg"
          priority
        />
      ) : (
        <Image
          src={LOGO_JPEG}
          alt="FarmaFácil"
          width={markSize}
          height={markSize}
          className="shrink-0 rounded-lg object-contain"
          onError={() => setImgError(true)}
          priority
        />
      )}
      <div className="flex flex-col leading-none">
        <span
          className="font-semibold tracking-tight text-foreground"
          style={{ fontSize: size * 0.42 }}
        >
          FarmaFácil
        </span>
        {showTagline && (
          <span
            className="font-medium text-muted-foreground"
            style={{ fontSize: size * 0.3 }}
          >
            Panel de gestión
          </span>
        )}
      </div>
    </div>
  );
}
