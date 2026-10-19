'use client';

import * as React from 'react';
import QRCode from 'qrcode';

/**
 * QR escaneable real (no el placeholder visual del panel demo).
 * Codifica una URL pública; no autentica por sí solo.
 */
export function ScannableQr({
  value,
  size = 280,
  className,
  label = 'Código QR',
}: {
  value: string;
  size?: number;
  className?: string;
  label?: string;
}) {
  const [dataUrl, setDataUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setError(false);
    setDataUrl(null);

    void QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        No se ha podido generar el código QR.
      </p>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className="animate-pulse rounded-2xl bg-muted"
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={label}
      className={className}
    />
  );
}
