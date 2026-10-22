'use client';

import * as React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
  previewDemoCatalogSeedAction,
  seedDemoCatalogAction,
} from '@/app/(app)/farmacias/[id]/catalog-actions';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Semilla demo de ~30 productos. Deprecada tras el catálogo maestro (100).
 * Si `deprecated`, el botón queda deshabilitado.
 */
export function SeedDemoCatalogButton({
  pharmacyId,
  deprecated = false,
}: {
  pharmacyId: string;
  deprecated?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);
  const [preview, setPreview] = React.useState<{
    templateTotal: number;
    alreadyPresent: number;
    willInsert: number;
    version: string;
  } | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  async function loadPreview() {
    setLoadingPreview(true);
    setPreviewError(null);
    setPreview(null);
    const result = await previewDemoCatalogSeedAction(pharmacyId);
    setLoadingPreview(false);
    if (!result.ok) {
      setPreviewError(result.error);
      return;
    }
    setPreview({
      templateTotal: result.templateTotal,
      alreadyPresent: result.alreadyPresent,
      willInsert: result.willInsert,
      version: result.version,
    });
  }

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      await loadPreview();
    }
  }

  async function confirmSeed() {
    setSeeding(true);
    const result = await seedDemoCatalogAction(pharmacyId);
    setSeeding(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.inserted === 0) {
      toast.message('No había productos demo nuevos que añadir.', {
        description: `Omitidos: ${result.skipped} (ya existían).`,
      });
    } else {
      toast.success(
        `Se han añadido ${result.inserted} productos de demostración.`,
        {
          description:
            result.skipped > 0
              ? `${result.skipped} ya existían y no se han modificado.`
              : undefined,
        }
      );
    }
    setOpen(false);
    router.refresh();
  }

  if (deprecated) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled
              >
                <Sparkles className="h-4 w-4" />
                Cargar catálogo inicial
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">
            Deprecado: usa el catálogo maestro (100 genéricos) vía preparación
            comercial o «Catálogo maestro» en Tarifas. No sembrar 30 demo.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="h-4 w-4" />
          Cargar catálogo inicial
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cargar catálogo inicial FarmaFácil</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Semilla demo antigua (~30). Preferible el catálogo maestro de
                100 tipos genéricos (flujo comercial).
              </p>
              {loadingPreview ? (
                <p className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculando diferencias…
                </p>
              ) : null}
              {previewError ? (
                <p className="text-destructive">{previewError}</p>
              ) : null}
              {preview ? (
                <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-foreground">
                  <p>
                    Se añadirán{' '}
                    <span className="font-semibold">{preview.willInsert}</span>{' '}
                    productos de demostración.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Los productos ya existentes no se modificarán
                    {preview.alreadyPresent > 0
                      ? ` (${preview.alreadyPresent} de la plantilla ya están presentes).`
                      : '.'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Plantilla {preview.version} · {preview.templateTotal} ítems
                  </p>
                </div>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={seeding}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={
              seeding ||
              loadingPreview ||
              !!previewError ||
              !preview ||
              preview.willInsert === 0
            }
            onClick={(e) => {
              e.preventDefault();
              void confirmSeed();
            }}
          >
            {seeding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cargando…
              </>
            ) : (
              'Confirmar carga'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
