'use client';

import * as React from 'react';
import { Printer } from 'lucide-react';

import { ScannableQr } from '@/components/kiosk/scannable-qr';
import { Button } from '@/components/ui/button';

/**
 * Pegatina imprimible: FarmaFácil + KSK legible + QR estable al activo.
 * El QR no autentica; la ficha sigue protegida por permisos de inventario.
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
        className="mx-auto flex w-[72mm] flex-col items-center gap-3 rounded-xl border-2 border-slate-900 bg-white p-4 text-slate-900 shadow-soft print:w-[72mm] print:border print:shadow-none"
        style={{ minHeight: '90mm' }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          FarmaFácil
        </p>
        <p className="text-center text-3xl font-bold tracking-tight">{assetCode}</p>
        <ScannableQr value={qrUrl} size={180} label={`QR ${assetCode}`} />
        {equipmentSerial ? (
          <p className="text-center text-[10px] text-slate-500">
            Serie: {equipmentSerial}
          </p>
        ) : (
          <p className="text-center text-[10px] text-amber-700">
            Serie pendiente
          </p>
        )}
        <p className="text-center text-[9px] leading-snug text-slate-400">
          Inventario interno. Escanear abre la ficha solo con acceso autorizado.
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground print:hidden">
        Destino QR: <span className="break-all font-mono">{qrUrl}</span>
      </p>
    </div>
  );
}
