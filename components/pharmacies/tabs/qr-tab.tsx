'use client';

import * as React from 'react';
import { Download, RefreshCw, FileImage, FileCode, Link as LinkIcon, Copy, Check } from 'lucide-react';
import type { Pharmacy } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode } from '@/components/shared/qr-code';

export function QrTab({ pharmacy }: { pharmacy: Pharmacy }) {
  const [seed, setSeed] = React.useState(pharmacy.qr.code);
  const [copied, setCopied] = React.useState(false);

  function regenerate() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code =
      'FF-' +
      pharmacy.id.toUpperCase() +
      '-' +
      Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setSeed(code);
  }

  function copyUrl() {
    navigator.clipboard?.writeText(pharmacy.qr.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* QR preview */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <QrCode value={seed} size={220} />
        </div>
        <p className="mt-5 text-sm font-medium text-foreground">
          {pharmacy.name}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Código: {seed}
        </p>
      </div>

      {/* Actions */}
      <div className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold text-foreground">URL pública</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Esta es la dirección que el código QR abre al escanearlo.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                readOnly
                value={pharmacy.qr.url}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={copyUrl}
              aria-label="Copiar URL"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Descargas</h4>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="gap-2">
              <FileImage className="h-4 w-4" /> Descargar PNG
            </Button>
            <Button variant="outline" className="gap-2">
              <FileCode className="h-4 w-4" /> Descargar SVG
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">
            Regenerar código
          </h4>
          <p className="text-xs text-muted-foreground">
            Genera un nuevo código QR. El anterior dejará de funcionar
            inmediatamente.
          </p>
          <Button variant="outline" className="gap-2" onClick={regenerate}>
            <RefreshCw className="h-4 w-4" /> Regenerar QR
          </Button>
        </div>
      </div>
    </div>
  );
}
