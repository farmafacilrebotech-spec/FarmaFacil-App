'use client';

import * as React from 'react';
import {
  Check,
  Copy,
  Download,
  FileCode,
  FileImage,
  Link as LinkIcon,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import type { PharmacyHomeEntrypoint } from '@/lib/pharmacies/pharmacy-home-entrypoint';
import {
  buildOfficialQrPngDataUrl,
  buildOfficialQrSvgString,
  downloadDataUrl,
  downloadTextFile,
  officialQrFilenames,
} from '@/lib/pharmacies/qr-download';
import { ScannableQr } from '@/components/kiosk/scannable-qr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * QR oficial de la farmacia (mismo public_entrypoints / URL que el kiosko).
 * No regenera el public_id desde la UI (permanente).
 */
export function QrTab({
  pharmacyName,
  entrypoint,
  loadError,
}: {
  pharmacyName: string;
  entrypoint: PharmacyHomeEntrypoint | null;
  loadError?: string | null;
}) {
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState<'png' | 'svg' | null>(null);

  async function copyUrl() {
    if (!entrypoint) return;
    try {
      await navigator.clipboard?.writeText(entrypoint.publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('URL copiada');
    } catch {
      toast.error('No se ha podido copiar la URL');
    }
  }

  async function downloadPng() {
    if (!entrypoint) return;
    setBusy('png');
    try {
      const dataUrl = await buildOfficialQrPngDataUrl(entrypoint.publicUrl);
      const { png } = officialQrFilenames(entrypoint.publicId);
      downloadDataUrl(png, dataUrl);
      toast.success('PNG descargado');
    } catch {
      toast.error('No se ha podido generar el PNG');
    } finally {
      setBusy(null);
    }
  }

  async function downloadSvg() {
    if (!entrypoint) return;
    setBusy('svg');
    try {
      const svg = await buildOfficialQrSvgString(entrypoint.publicUrl);
      const { svg: filename } = officialQrFilenames(entrypoint.publicId);
      downloadTextFile(filename, svg);
      toast.success('SVG descargado');
    } catch {
      toast.error('No se ha podido generar el SVG');
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {loadError}
      </div>
    );
  }

  if (!entrypoint) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        Esta farmacia aún no tiene QR oficial provisionado. Aplica la migración
        042 o vuelve a abrir esta ficha tras el alta.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <ScannableQr
            value={entrypoint.publicUrl}
            size={220}
            label={`QR oficial de ${pharmacyName}`}
          />
        </div>
        <p className="mt-5 text-sm font-medium text-foreground">{pharmacyName}</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {entrypoint.publicId}
        </p>
        <p className="mt-3 max-w-sm text-center text-xs text-muted-foreground">
          Código permanente. Identifica la farmacia; no inicia sesión de
          clientes ni abre el panel de gestión.
        </p>
      </div>

      <div className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold text-foreground">URL pública oficial</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Misma URL en kiosko, escaparate, tarjetas y SuperAdmin.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <LinkIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                readOnly
                value={entrypoint.publicUrl}
                className="pl-9 font-mono text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              onClick={() => void copyUrl()}
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
            <Button
              variant="outline"
              className="gap-2"
              disabled={busy !== null}
              onClick={() => void downloadPng()}
            >
              {busy === 'png' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileImage className="h-4 w-4" />
              )}
              PNG ({/* 1024px */}alta res.)
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={busy !== null}
              onClick={() => void downloadSvg()}
            >
              {busy === 'svg' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileCode className="h-4 w-4" />
              )}
              SVG vectorial
            </Button>
          </div>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Ideal para pegatinas, escaparate e impresión. El contenido del QR no
            cambia al renombrar la farmacia.
          </p>
        </div>
      </div>
    </div>
  );
}
