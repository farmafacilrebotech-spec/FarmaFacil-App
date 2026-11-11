'use client';

import * as React from 'react';
import Image from 'next/image';
import { Printer } from 'lucide-react';

import { ScannableQr } from '@/components/kiosk/scannable-qr';
import { Button } from '@/components/ui/button';

/**
 * Pegatina física: mismo logo circular B/N de tickets (`ff_ticket_logo`)
 * + KSK + QR + serie. Sin color de estado. No altera la impresión de tickets.
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
        className="mx-auto flex w-[72mm] flex-col items-center gap-2.5 border border-black bg-white px-4 py-3.5 text-black print:w-[72mm] print:border print:shadow-none"
        style={{ minHeight: '98mm' }}
      >
        {/*
          Recurso idéntico al drawable Android de tickets:
          android-kiosk/.../drawable-nodpi/ff_ticket_logo.png
        */}
        <div className="flex flex-col items-center gap-1">
          <span
            className="inline-flex shrink-0 overflow-hidden rounded-full"
            style={{ width: 56, height: 56 }}
          >
            <Image
              src="/images/logos/ff_ticket_logo.png"
              alt="FarmaFácil"
              width={56}
              height={56}
              className="h-full w-full object-contain"
              priority
              unoptimized
            />
          </span>
          {/* ~55–60 % del text-3xl del código KSK; B/N térmico */}
          <p className="text-center text-[1.05rem] font-bold uppercase leading-none tracking-wide text-black">
            FARMAFÁCIL
          </p>
          <p className="mt-0.5 text-center text-3xl font-bold tracking-tight text-black">
            {assetCode}
          </p>
        </div>

        <ScannableQr value={qrUrl} size={168} label={`QR ${assetCode}`} />

        <p className="text-center text-[11px] font-medium text-black">
          {equipmentSerial
            ? `Serie: ${equipmentSerial}`
            : 'Serie pendiente'}
        </p>

        <p className="text-center text-[9px] leading-snug text-neutral-700">
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
