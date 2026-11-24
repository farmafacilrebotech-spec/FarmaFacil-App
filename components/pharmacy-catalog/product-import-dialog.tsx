'use client';

import * as React from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  confirmProductImportAction,
  previewProductImportAction,
} from '@/app/f/[pharmacyId]/catalogo/actions';
import {
  PRODUCT_COLUMN_HINTS,
  buildProductImportReport,
} from '@/lib/pharmacies/product-import';
import type { ColumnMapping } from '@/lib/import/spreadsheet';
import type {
  ProductImportAction,
  ProductImportPreview,
} from '@/lib/pharmacies/product-import';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type Step = 'upload' | 'mapping' | 'preview' | 'done';

export function ProductImportDialog({
  open,
  onOpenChange,
  pharmacyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacyId: string;
}) {
  const [step, setStep] = React.useState<Step>('upload');
  const [file, setFile] = React.useState<File | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [mapping, setMapping] = React.useState<ColumnMapping>({});
  const [preview, setPreview] = React.useState<ProductImportPreview | null>(
    null
  );
  const [busy, setBusy] = React.useState(false);
  const [previewFilter, setPreviewFilter] = React.useState<'all' | ProductImportAction>(
    'all'
  );
  const [progressLabel, setProgressLabel] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    created: number;
    updated: number;
    skipped: number;
    elapsedMs?: number;
    mode?: string;
  } | null>(null);

  React.useEffect(() => {
    if (!open) {
      setStep('upload');
      setFile(null);
      setHeaders([]);
      setMapping({});
      setPreview(null);
      setPreviewFilter('all');
      setResult(null);
      setBusy(false);
    }
  }, [open]);

  function downloadPreviewReport() {
    if (!preview) return;
    const text = buildProductImportReport(preview);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `farmafacil-import-preview-${pharmacyId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runPreview(nextMapping?: ColumnMapping) {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set('file', file);
    const map = nextMapping ?? mapping;
    fd.set('mapping', JSON.stringify(map));
    const res = await previewProductImportAction(pharmacyId, fd);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setHeaders(res.headers);
    setMapping(res.suggestedMapping);
    // If user already chose mapping, keep it when re-previewing
    if (nextMapping) setMapping(nextMapping);
    else setMapping(res.suggestedMapping);
    setPreview(res.preview);
    setStep(nextMapping ? 'preview' : 'mapping');
  }

  async function onFileChosen(f: File | null) {
    if (!f) return;
    setFile(f);
    setBusy(true);
    const fd = new FormData();
    fd.set('file', f);
    const res = await previewProductImportAction(pharmacyId, fd);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      setFile(null);
      return;
    }
    setHeaders(res.headers);
    setMapping(res.suggestedMapping);
    setPreview(res.preview);
    setStep('mapping');
  }

  async function onConfirm() {
    if (!preview) return;
    setBusy(true);
    setProgressLabel('Importando por lotes…');
    const res = await confirmProductImportAction(pharmacyId, {
      rows: preview.rows.map((r) => ({
        action: r.action,
        matchedProductId: r.matchedProductId,
        draft: r.draft,
      })),
    });
    setBusy(false);
    setProgressLabel(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setResult({
      created: res.created,
      updated: res.updated,
      skipped: res.skipped,
      elapsedMs: res.elapsedMs,
      mode: res.mode,
    });
    setStep('done');
    toast.success(
      `Importación completada en ${((res.elapsedMs ?? 0) / 1000).toFixed(1)} s (${res.mode}).`
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar catálogo</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sube un archivo .xlsx o .csv. No se guardará nada hasta que
              confirmes la importación.
            </p>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center transition-colors hover:bg-muted/50">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                Seleccionar archivo
              </span>
              <span className="text-xs text-muted-foreground">
                Máx. 2 MB · hasta 20.000 filas · escritura por lotes
              </span>
              <input
                type="file"
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  void onFileChosen(f);
                }}
              />
            </label>
            {busy ? (
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Leyendo archivo…
              </p>
            ) : null}
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="truncate font-medium text-foreground">
                {file?.name}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Revisa el mapeo de columnas. FarmaFácil ha propuesto coincidencias
              automáticas; puedes corregirlas.
            </p>
            <div className="space-y-3">
              {PRODUCT_COLUMN_HINTS.map((hint) => (
                <div
                  key={hint.field}
                  className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[140px_1fr]"
                >
                  <Label className="text-sm">
                    {hint.label}
                    {hint.required ? ' *' : ''}
                  </Label>
                  <Select
                    value={
                      mapping[hint.field] != null
                        ? String(mapping[hint.field])
                        : '__none__'
                    }
                    onValueChange={(v) => {
                      setMapping((prev) => ({
                        ...prev,
                        [hint.field]:
                          v === '__none__' ? null : Number(v),
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="— No mapear —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— No mapear —</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={`${h}-${i}`} value={String(i)}>
                          {h || `(Columna ${i + 1})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('upload')}
                disabled={busy}
              >
                Atrás
              </Button>
              <Button
                type="button"
                disabled={busy || mapping.name == null}
                onClick={() => void runPreview(mapping)}
              >
                {busy ? 'Validando…' : 'Vista previa'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label="Leídas"
                value={preview.summary.rowsRead ?? preview.summary.total}
              />
              <Stat
                label="Vacías"
                value={preview.summary.emptyDiscarded ?? 0}
                tone="muted"
              />
              <Stat
                label="Inválidas"
                value={preview.summary.invalidRows ?? 0}
                tone="muted"
              />
              <Stat
                label="Duplicados"
                value={preview.summary.duplicatesInFile ?? 0}
                tone="warning"
              />
              <Stat
                label="Nuevos"
                value={preview.summary.creates}
                tone="success"
              />
              <Stat
                label="Actualizar"
                value={preview.summary.updates}
                tone="warning"
              />
              <Stat
                label="Sin cambios"
                value={preview.summary.unchanged ?? 0}
                tone="muted"
              />
              <Stat
                label="Pend. clasificar"
                value={preview.summary.pendingClassification ?? 0}
                tone="warning"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Se crearán{' '}
              <strong>{preview.summary.creates}</strong> productos, se
              actualizarán <strong>{preview.summary.updates}</strong>,{' '}
              <strong>{preview.summary.unchanged ?? 0}</strong> sin cambios,{' '}
              <strong>{preview.summary.emptyDiscarded ?? 0}</strong> vacías,{' '}
              <strong>{preview.summary.invalidRows ?? 0}</strong> inválidas y{' '}
              <strong>{preview.summary.pendingClassification ?? 0}</strong>{' '}
              pendientes de clasificación. Todavía no se ha escrito nada en la
              base de datos.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-xs text-muted-foreground">Filtrar</Label>
              <Select
                value={previewFilter}
                onValueChange={(v) =>
                  setPreviewFilter(v as 'all' | ProductImportAction)
                }
              >
                <SelectTrigger className="h-8 w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="create">Nuevos</SelectItem>
                  <SelectItem value="update">Actualizar</SelectItem>
                  <SelectItem value="unchanged">Sin cambios</SelectItem>
                  <SelectItem value="pending_classification">
                    Pend. clasificar
                  </SelectItem>
                  <SelectItem value="skip">Omitidas</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadPreviewReport}
              >
                Descargar informe
              </Button>
            </div>
            <div className="max-h-56 overflow-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="px-2 py-1.5">Fila</th>
                    <th className="px-2 py-1.5">Producto</th>
                    <th className="px-2 py-1.5">Acción</th>
                    <th className="px-2 py-1.5">Avisos</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows
                    .filter(
                      (r) =>
                        previewFilter === 'all' || r.action === previewFilter
                    )
                    .slice(0, 50)
                    .map((r) => (
                    <tr key={r.draft.rowIndex} className="border-t border-border">
                      <td className="px-2 py-1.5">{r.draft.rowIndex}</td>
                      <td className="max-w-[180px] truncate px-2 py-1.5">
                        {r.draft.name || '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge
                          variant={
                            r.action === 'create'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {r.action === 'create'
                            ? 'Nuevo'
                            : r.action === 'update'
                              ? 'Actualizar'
                              : r.action === 'unchanged'
                                ? 'Sin cambios'
                              : r.action === 'pending_classification'
                                ? 'Pend. clasificar'
                                : 'Omitir'}
                        </Badge>
                      </td>
                      <td className="max-w-[220px] truncate px-2 py-1.5 text-muted-foreground">
                        {r.issues.map((i) => i.message).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.filter(
                (r) => previewFilter === 'all' || r.action === previewFilter
              ).length > 50 ? (
                <p className="border-t border-border px-2 py-1.5 text-xs text-muted-foreground">
                  Mostrando 50 filas del filtro actual.
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('mapping')}
                disabled={busy}
              >
                Atrás
              </Button>
              <Button
                type="button"
                disabled={
                  busy ||
                  preview.summary.creates + preview.summary.updates === 0
                }
                onClick={() => void onConfirm()}
              >
                {busy ? 'Importando…' : 'Confirmar importación'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <div>
              <p className="text-base font-semibold text-foreground">
                Importación completada
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.created} nuevos · {result.updated} actualizados ·{' '}
                {result.skipped} omitidos
                {result.elapsedMs != null
                  ? ` · ${(result.elapsedMs / 1000).toFixed(1)} s (${result.mode ?? 'batch'})`
                  : ''}
                {progressLabel ? ` · ${progressLabel}` : ''}
              </p>
            </div>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'warning' | 'muted';
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          tone === 'success'
            ? 'text-lg font-semibold text-emerald-600'
            : tone === 'warning'
              ? 'text-lg font-semibold text-amber-600'
              : 'text-lg font-semibold text-foreground'
        }
      >
        {value}
      </p>
    </div>
  );
}
