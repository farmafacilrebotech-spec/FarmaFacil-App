'use client';

import * as React from 'react';
import { ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import {
  removePharmacyLogoAction,
  uploadPharmacyLogoAction,
} from '@/app/(app)/farmacias/logo-actions';
import { PharmacyLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { PHARMACY_LOGO_MAX_BYTES } from '@/lib/pharmacies/pharmacy-logo-file';
import { cn } from '@/lib/utils';

type Props = {
  pharmacyId: string;
  pharmacyName: string;
  logoUrl: string | null;
  logoColor: string;
  /** false = solo lectura (p. ej. farmacéutico). */
  canManage: boolean;
  className?: string;
  onLogoChange?: (logoUrl: string | null) => void;
};

/**
 * Gestión de logo de farmacia (subir / reemplazar / eliminar).
 * Reutilizable en SuperAdmin Personalización y panel tenant.
 */
export function PharmacyLogoManager({
  pharmacyId,
  pharmacyName,
  logoUrl,
  logoColor,
  canManage,
  className,
  onLogoChange,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [currentUrl, setCurrentUrl] = React.useState<string | null>(logoUrl);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState<'upload' | 'remove' | null>(null);

  React.useEffect(() => {
    setCurrentUrl(logoUrl);
  }, [logoUrl]);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearPending() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function onPickFile(file: File | null) {
    if (!file) return;
    if (file.size > PHARMACY_LOGO_MAX_BYTES) {
      toast.error('El logo no puede superar 2 MB.');
      return;
    }
    const type = file.type.toLowerCase();
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/jpg'].includes(type)) {
      // SVG u otros: rechazo temprano en UI
      if (type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        toast.error('SVG no está permitido. Usa PNG, JPG o WebP.');
        return;
      }
      toast.error('Formato no válido. Solo PNG, JPG o WebP.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function confirmUpload() {
    if (!pendingFile || busy) return;
    setBusy('upload');
    try {
      const fd = new FormData();
      fd.set('file', pendingFile);
      const result = await uploadPharmacyLogoAction(pharmacyId, fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrentUrl(result.logoUrl);
      onLogoChange?.(result.logoUrl);
      clearPending();
      toast.success('Logo actualizado');
    } catch {
      toast.error('No se ha podido subir el logo');
    } finally {
      setBusy(null);
    }
  }

  async function confirmRemove() {
    if (busy) return;
    setBusy('remove');
    try {
      const result = await removePharmacyLogoAction(pharmacyId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCurrentUrl(null);
      onLogoChange?.(null);
      clearPending();
      toast.success('Logo eliminado');
    } catch {
      toast.error('No se ha podido eliminar el logo');
    } finally {
      setBusy(null);
    }
  }

  const displayUrl = previewUrl || currentUrl;

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-5 shadow-soft',
        className
      )}
    >
      <h3 className="text-sm font-semibold text-foreground">
        Logo de la farmacia
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Se usa en el cartel QR y en la identidad de la farmacia. PNG, JPG o
        WebP · máx. 2 MB · sin recortes.
      </p>

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 p-2">
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt={`Logo de ${pharmacyName}`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageIcon className="h-8 w-8 opacity-50" />
              <span className="text-[10px]">Sin logo</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <PharmacyLogo
              name={pharmacyName}
              logoUrl={displayUrl}
              logoColor={logoColor}
              size={48}
              rounded="2xl"
            />
            <div className="min-w-0 text-xs text-muted-foreground">
              Vista en panel
              {previewUrl ? (
                <span className="ml-1 text-amber-700 dark:text-amber-400">
                  (vista previa)
                </span>
              ) : null}
            </div>
          </div>

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busy !== null}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {currentUrl ? 'Reemplazar' : 'Subir logo'}
              </Button>
              {pendingFile ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    disabled={busy !== null}
                    onClick={() => void confirmUpload()}
                  >
                    {busy === 'upload' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Confirmar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy !== null}
                    onClick={clearPending}
                  >
                    Cancelar
                  </Button>
                </>
              ) : null}
              {currentUrl && !pendingFile ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={busy !== null}
                  onClick={() => void confirmRemove()}
                >
                  {busy === 'remove' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Eliminar
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Solo el propietario o administrador pueden cambiar el logo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
