'use client';

import * as React from 'react';
import Image from 'next/image';
import { Printer } from 'lucide-react';

import { ScannableQr } from '@/components/kiosk/scannable-qr';
import { Button } from '@/components/ui/button';

/**
 * Pegatina física: logo circular oficial + KSK + QR + serie.
 * B/N para impresión; sin color de estado del inventario.
 * El QR no autentica; la ficha sigue protegida por permisos.
 */
export function AssetSticker({
  assetCode,
  qrUrl,
  equipmentSerial,
}: {
  assetCode: string;
  qrUrl: string;
  equipmentSerial: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button type="button" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir pegatina
        </Button>
      </div>

      <div
        className="mx-auto flex w-[72mm] flex-col items-center gap-3 border border-black bg-white p-4 text-black print:w-[72mm] print:shadow-none"
        style={{ minHeight: '95mm' }}
      >
        <span
          className="inline-flex shrink-0 overflow-hidden rounded-full print:grayscale"
          style={{ width: 56, height: 56 }}
        >
          <Image
            src="/images/logos/farmafacil-logo-512.png"
            alt="FarmaFácil"
            width={56}
            height={56}
            className="h-full w-full object-cover"
            priority
          />
        </span>

        <p className="text-center text-3xl font-bold tracking-tight">{assetCode}</p>

        <ScannableQr value={qrUrl} size={168} label={`QR ${assetCode}`} />

        <p className="text-center text-[11px] font-medium text-black">
          {equipmentSerial
            ? `Serie: ${equipmentSerial}`
            : 'Serie pendiente'}
        </p>

        <p className="text-center text-[9px] leading-snug text-neutral-600">
          Inventario interno FarmaFácil. Escanear abre la ficha solo con acceso
          autorizado.
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground print:hidden">
        Destino QR: <span className="break-all font-mono">{qrUrl}</span>
      </p>
    </div>
  );
}
