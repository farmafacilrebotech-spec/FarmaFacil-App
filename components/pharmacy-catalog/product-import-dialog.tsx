'use client';

import * as React from 'react';
import {
  CheckCircle2,
  FileSpreadsheet,
  History,
  Loader2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  confirmProductImportBatchAction,
  listCatalogImportJobsAction,
  listImportEquivalencesAction,
  previewProductImportAction,
  revertCatalogImportJobAction,
  upsertImportEquivalencesAction,
  type ImportJobSummary,
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
import {
  runProductImportBatches,
  type ProductImportBatchRow,
} from '@/lib/pharmacies/product-import-batch';
import {
  applyEquivalencesToDrafts,
  loadLocalEquivalences,
  saveLocalEquivalences,
  uniqueSourceFamilies,
  type CategoryEquivalence,
} from '@/lib/pharmacies/import-equivalences';
import { listCommercialCategories } from '@/lib/catalog/taxonomy';
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
import { Input } from '@/components/ui/input';

type Step =
  | 'upload'
  | 'mapping'
  | 'equivalences'
  | 'preview'
  | 'done'
  | 'history';

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
  const [previewFilter, setPreviewFilter] = React.useState<
    'all' | ProductImportAction
  >('all');
  const [progressLabel, setProgressLabel] = React.useState<string | null>(null);
  const [progressPct, setProgressPct] = React.useState(0);
  const [supplierKey, setSupplierKey] = React.useState('');
  const [sourceFormat, setSourceFormat] = React.useState('xlsx');
  const [familyMap, setFamilyMap] = React.useState<
    Record<string, string>
  >({});
  const [jobs, setJobs] = React.useState<ImportJobSummary[]>([]);
  const [result, setResult] = React.useState<{
    created: number;
    updated: number;
    skipped: number;
    errors?: number;
    elapsedMs?: number;
    mode?: string;
    jobId?: string;
  } | null>(null);

  const categoryOptions = React.useMemo(
    () =>
      listCommercialCategories().map((c) => ({
        slug: c.slug,
        name: c.name,
      })),
    []
  );

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
      setProgressLabel(null);
      setProgressPct(0);
      setFamilyMap({});
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
    if (nextMapping) setMapping(nextMapping);
    else setMapping(res.suggestedMapping);
    setPreview(res.preview);

    const families = uniqueSourceFamilies(
      res.preview.rows.map((r) => r.draft)
    );
    const local = loadLocalEquivalences(pharmacyId);
    const server = await listImportEquivalencesAction(pharmacyId);
    const merged = [
      ...local,
      ...(server.ok ? server.items : []),
    ];
    const nextMap: Record<string, string> = {};
    for (const f of families) {
      const key = `${f.sourceFamily}||${f.sourceSubfamily ?? ''}`;
      const hit = merged.find(
        (e) =>
          e.sourceFamily.toLowerCase() === f.sourceFamily.toLowerCase() &&
          (e.sourceSubfamily ?? '') === (f.sourceSubfamily ?? '')
      );
      if (hit?.categorySlug) nextMap[key] = hit.categorySlug;
    }
    setFamilyMap(nextMap);
    setStep(families.length ? 'equivalences' : 'preview');
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

  function buildEquivalenceList(): CategoryEquivalence[] {
    if (!preview) return [];
    const families = uniqueSourceFamilies(preview.rows.map((r) => r.draft));
    const out: CategoryEquivalence[] = [];
    for (const f of families) {
      const key = `${f.sourceFamily}||${f.sourceSubfamily ?? ''}`;
      const slug = familyMap[key];
      if (!slug) continue;
      const opt = categoryOptions.find((c) => c.slug === slug);
      if (!opt) continue;
      out.push({
        pharmacyId,
        supplierKey: supplierKey.trim() || null,
        sourceFormat: sourceFormat.trim() || null,
        sourceFamily: f.sourceFamily,
        sourceSubfamily: f.sourceSubfamily,
        categorySlug: opt.slug,
        categoryName: opt.name,
      });
    }
    return out;
  }

  async function applyEquivalencesAndPreview() {
    if (!preview) return;
    const eqs = buildEquivalenceList();
    saveLocalEquivalences(pharmacyId, [
      ...loadLocalEquivalences(pharmacyId).filter(
        (e) =>
          !eqs.some(
            (n) =>
              n.sourceFamily === e.sourceFamily &&
              (n.sourceSubfamily ?? '') === (e.sourceSubfamily ?? '')
          )
      ),
      ...eqs,
    ]);
    setBusy(true);
    const upsert = await upsertImportEquivalencesAction(
      pharmacyId,
      eqs.map((e) => ({
        supplierKey: e.supplierKey,
        sourceFormat: e.sourceFormat,
        sourceFamily: e.sourceFamily,
        sourceSubfamily: e.sourceSubfamily,
        categorySlug: e.categorySlug,
      }))
    );
    setBusy(false);
    if (upsert.ok && upsert.persisted) {
      toast.success('Equivalencias guardadas en BD.');
    } else if (upsert.ok) {
      toast.message(
        'Equivalencias guardadas en este dispositivo (BD 089 pendiente).'
      );
    }

    const patchedDrafts = applyEquivalencesToDrafts(
      preview.rows.map((r) => r.draft),
      eqs
    );
    // Rebuild preview locally with patched categories (same sheet headers/mapping).
    const rebuilt = {
      ...preview,
      rows: preview.rows.map((r, i) => ({
        ...r,
        draft: patchedDrafts[i],
      })),
    };
    // Re-run action classification with patched drafts via simple heuristic.
    const reclassified = rebuilt.rows.map((r) => {
      if (
        r.action === 'pending_classification' &&
        r.draft.category?.trim()
      ) {
        return {
          ...r,
          action: (r.matchedProductId ? 'update' : 'create') as ProductImportAction,
          issues: r.issues.filter(
            (i) => !i.message.includes('Pendiente de clasificar')
          ),
        };
      }
      return r;
    });
    const nextPreview: ProductImportPreview = {
      ...rebuilt,
      rows: reclassified,
      summary: {
        ...rebuilt.summary,
        creates: reclassified.filter((r) => r.action === 'create').length,
        updates: reclassified.filter((r) => r.action === 'update').length,
        pendingClassification: reclassified.filter(
          (r) => r.action === 'pending_classification'
        ).length,
        valid: reclassified.filter(
          (r) => r.action === 'create' || r.action === 'update'
        ).length,
      },
    };
    setPreview(nextPreview);
    setStep('preview');
  }

  async function onConfirm() {
    if (!preview) return;
    setBusy(true);
    setProgressPct(0);
    setProgressLabel('Preparando lotes…');

    const rows: ProductImportBatchRow[] = preview.rows
      .filter(
        (r) =>
          r.action === 'create' ||
          r.action === 'update' ||
          r.action === 'pending_classification'
      )
      .map((r) => ({
        matchedProductId: r.matchedProductId,
        draft: r.draft,
      }));

    const started = Date.now();
    const batchResult = await runProductImportBatches({
      pharmacyId,
      rows,
      sourceFilename: file?.name ?? null,
      action: confirmProductImportBatchAction,
      onProgress: (p) => {
        setProgressPct(
          p.totalRows ? Math.round((p.processedRows / p.totalRows) * 100) : 0
        );
        setProgressLabel(
          `Lote ${p.batchIndex}/${p.batchCount} · ${p.processedRows}/${p.totalRows} filas`
        );
      },
    });

    setBusy(false);
    if (!batchResult.ok) {
      setProgressLabel(null);
      toast.error(batchResult.error);
      return;
    }

    const elapsedMs = Date.now() - started;
    setResult({
      created: batchResult.totals.created,
      updated: batchResult.totals.updated,
      skipped: batchResult.totals.skipped,
      errors: batchResult.totals.errors,
      elapsedMs,
      mode: 'client_batches',
      jobId: batchResult.totals.jobId,
    });
    setProgressLabel(null);
    setStep('done');
    toast.success(
      `Importación completada en ${(elapsedMs / 1000).toFixed(1)} s.`
    );
  }

  async function openHistory() {
    setBusy(true);
    const res = await listCatalogImportJobsAction(pharmacyId);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setJobs(res.jobs);
    setStep('history');
    if (!res.jobs.length) {
      toast.message(
        'Sin historial en BD (migración 090 no aplicada en este entorno).'
      );
    }
  }

  async function onRevert(jobId: string) {
    setBusy(true);
    const res = await revertCatalogImportJobAction(pharmacyId, jobId);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Revertido: ${res.deactivated} desactivados · ${res.keptActiveModified} conservados (editados después).`
    );
    void openHistory();
  }

  const families = preview
    ? uniqueSourceFamilies(preview.rows.map((r) => r.draft))
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span>Importar catálogo</span>
            {step !== 'history' ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={() => void openHistory()}
              >
                <History className="h-3.5 w-3.5" />
                Historial
              </Button>
            ) : null}
          </DialogTitle>
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
                Máx. 8 MB · hasta 20.000 filas · escritura por lotes
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
                        [hint.field]: v === '__none__' ? null : Number(v),
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
                {busy ? 'Validando…' : 'Siguiente'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'equivalences' && preview && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Mapea familias del proveedor a la taxonomía FarmaFácil (26). Se
              guardan por farmacia, proveedor y formato.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Proveedor / clave</Label>
                <Input
                  value={supplierKey}
                  onChange={(e) => setSupplierKey(e.target.value)}
                  placeholder="p. ej. COFARES"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Formato</Label>
                <Input
                  value={sourceFormat}
                  onChange={(e) => setSourceFormat(e.target.value)}
                  placeholder="xlsx"
                />
              </div>
            </div>
            <div className="max-h-64 space-y-3 overflow-auto rounded-lg border border-border p-3">
              {families.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay familias de origen en el archivo.
                </p>
              ) : (
                families.map((f) => {
                  const key = `${f.sourceFamily}||${f.sourceSubfamily ?? ''}`;
                  return (
                    <div
                      key={key}
                      className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1fr]"
                    >
                      <div className="text-sm">
                        <p className="font-medium">{f.sourceFamily}</p>
                        {f.sourceSubfamily ? (
                          <p className="text-xs text-muted-foreground">
                            {f.sourceSubfamily}
                          </p>
                        ) : null}
                      </div>
                      <Select
                        value={familyMap[key] || '__none__'}
                        onValueChange={(v) =>
                          setFamilyMap((prev) => ({
                            ...prev,
                            [key]: v === '__none__' ? '' : v,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Categoría FF" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            — Pendiente de clasificar —
                          </SelectItem>
                          {categoryOptions.map((c) => (
                            <SelectItem key={c.slug} value={c.slug}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })
              )}
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
                disabled={busy}
                onClick={() => void applyEquivalencesAndPreview()}
              >
                {busy ? 'Aplicando…' : 'Vista previa'}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Leídas" value={preview.summary.rowsRead ?? preview.summary.total} />
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
              <Stat label="Nuevos" value={preview.summary.creates} tone="success" />
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
              Todavía no se ha escrito nada. Los pendientes se guardarán
              inactivos como «Pendiente de clasificar».
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
                      <tr
                        key={r.draft.rowIndex}
                        className="border-t border-border"
                      >
                        <td className="px-2 py-1.5">{r.draft.rowIndex}</td>
                        <td className="max-w-[180px] truncate px-2 py-1.5">
                          {r.draft.name || '—'}
                        </td>
                        <td className="px-2 py-1.5">
                          <Badge
                            variant={
                              r.action === 'create' ? 'secondary' : 'outline'
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
            </div>
            {busy ? (
              <div className="space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progressLabel ?? 'Importando…'}
                </p>
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setStep(families.length ? 'equivalences' : 'mapping')
                }
                disabled={busy}
              >
                Atrás
              </Button>
              <Button
                type="button"
                disabled={
                  busy ||
                  preview.summary.creates +
                    preview.summary.updates +
                    (preview.summary.pendingClassification ?? 0) ===
                    0
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
                {result.errors ? ` · ${result.errors} errores` : ''}
                {result.elapsedMs != null
                  ? ` · ${(result.elapsedMs / 1000).toFixed(1)} s`
                  : ''}
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button type="button" variant="outline" onClick={() => void openHistory()}>
                Ver historial
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}

        {step === 'history' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Revertir solo desactiva altas no editadas después por la
              farmacia.
            </p>
            {jobs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No hay jobs registrados. Requiere migración 090 en BD aislada.
              </p>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-auto">
                {jobs.map((j) => (
                  <li
                    key={j.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {j.sourceFilename || j.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {j.status} · {new Date(j.createdAt).toLocaleString('es')}
                      </p>
                    </div>
                    {j.status === 'completed' || j.status === 'partially_reverted' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void onRevert(j.id)}
                      >
                        Revertir
                      </Button>
                    ) : (
                      <Badge variant="outline">{j.status}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('upload')}>
                Nueva importación
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </DialogFooter>
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
