'use client';

import * as React from 'react';
import {
  Archive,
  ArchiveRestore,
  Download,
  Pencil,
  Plus,
  Search,
  Upload,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';

import type { PharmacyProduct } from '@/lib/pharmacies/products-types';
import { formatCatalogPriceLabel } from '@/lib/catalog/price-display';
import { formatCurrency, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  bulkSetPharmacyProductsActiveAction,
  bulkSetPharmacyProductsCategoryAction,
  setPharmacyProductActiveAction,
} from '@/app/f/[pharmacyId]/catalogo/actions';
import { ProductFormDialog } from '@/components/pharmacy-catalog/product-form-dialog';
import { ProductImportDialog } from '@/components/pharmacy-catalog/product-import-dialog';
import { buildProductTemplateCsv } from '@/lib/pharmacies/product-import';
import {
  catalogUiPermissions,
  type CatalogWriteCapability,
} from '@/lib/pharmacies/catalog-permissions';
import {
  PENDING_CLASSIFICATION_NAME,
  isPendingClassificationCategory,
  listCommercialCategories,
} from '@/lib/catalog/taxonomy';
import { Checkbox } from '@/components/ui/checkbox';

export function PharmacyCatalogView({
  pharmacyId,
  pharmacyName,
  products,
  categories,
  loadError,
  catalogMode = 'own',
  writeCapability = 'manage',
  variant = 'page',
  toolbarExtra,
}: {
  pharmacyId: string;
  pharmacyName: string;
  products: PharmacyProduct[];
  categories: string[];
  loadError?: string | null;
  /** generic: sin PVP/stock ficticios ni import propio */
  catalogMode?: 'generic' | 'own';
  /** Matriz 074: manage | stock | read */
  writeCapability?: CatalogWriteCapability;
  /** page = cabecera completa tenant; embedded = pestaña SuperAdmin */
  variant?: 'page' | 'embedded';
  toolbarExtra?: React.ReactNode;
}) {
  const isGeneric = catalogMode === 'generic';
  const ui = catalogUiPermissions(writeCapability);
  const showWriteActions = !isGeneric && (ui.canEditStock || ui.canEditCommercial);
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [status, setStatus] = React.useState<
    'all' | 'active' | 'inactive' | 'pending'
  >('all');
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PharmacyProduct | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [page, setPage] = React.useState(1);
  /** Stock es opcional: oculto por defecto (no inventariamos FarmaFácil). */
  const [showStockColumn, setShowStockColumn] = React.useState(false);
  const pageSize = 50;
  const taxonomyCats = React.useMemo(() => listCommercialCategories(), []);

  const categoryOptions = React.useMemo(() => {
    const fromTaxonomy = taxonomyCats.map((c) => c.name);
    const extras = categories.filter(
      (c) =>
        !fromTaxonomy.includes(c) && !isPendingClassificationCategory(c)
    );
    return [...fromTaxonomy, ...extras.sort((a, b) => a.localeCompare(b, 'es'))];
  }, [categories, taxonomyCats]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const pending = isPendingClassificationCategory(p.category);
      if (status === 'active' && (!p.isActive || pending)) return false;
      if (status === 'inactive' && (p.isActive || pending)) return false;
      if (status === 'pending' && !pending) return false;
      if (category !== 'all' && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku?.toLowerCase().includes(q) ?? false) ||
        (p.ean?.toLowerCase().includes(q) ?? false) ||
        (p.brand?.toLowerCase().includes(q) ?? false) ||
        (p.category?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [products, query, category, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = React.useMemo(() => {
    const safe = Math.min(page, pageCount);
    const start = (safe - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageCount]);

  React.useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [query, category, status]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectPage() {
    const ids = paged.map((p) => p.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const allOnPage = ids.every((id) => next.has(id));
      if (allOnPage) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkArchive(active: boolean) {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const res = await bulkSetPharmacyProductsActiveAction(
      pharmacyId,
      ids,
      active
    );
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSelected(new Set());
    toast.success(
      active
        ? `${ids.length} productos reactivados.`
        : `${ids.length} productos archivados.`
    );
  }

  async function bulkCategorize(catName: string) {
    const ids = Array.from(selected);
    if (!ids.length || !catName) return;
    const res = await bulkSetPharmacyProductsCategoryAction(
      pharmacyId,
      ids,
      catName
    );
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setSelected(new Set());
    toast.success(`Categoría «${catName}» aplicada a ${ids.length} productos.`);
  }

  function downloadTemplate() {
    const csv = buildProductTemplateCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'farmafacil-plantilla-catalogo.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function toggleActive(product: PharmacyProduct) {
    setBusyId(product.id);
    const result = await setPharmacyProductActiveAction(
      pharmacyId,
      product.id,
      !product.isActive
    );
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      product.isActive ? 'Producto archivado.' : 'Producto reactivado.'
    );
  }

  const actions = (
    <>
      {toolbarExtra}
      {!isGeneric && ui.canCreateOrImport ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={downloadTemplate}
          >
            <Download className="h-4 w-4" /> Plantilla
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-4 w-4" /> Importar Excel/CSV
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Añadir producto
          </Button>
        </>
      ) : null}
      {!isGeneric && writeCapability === 'stock' ? (
        <Badge variant="outline" className="font-normal">
          Solo stock y disponibilidad
        </Badge>
      ) : null}
      {!isGeneric && writeCapability === 'read' ? (
        <Badge variant="outline" className="font-normal">
          Solo consulta
        </Badge>
      ) : null}
      {isGeneric ? (
        <Badge variant="outline" className="font-normal">
          Modalidad genérica · sin import propio
        </Badge>
      ) : null}
    </>
  );

  return (
    <div
      className={
        variant === 'page'
          ? 'mx-auto w-full max-w-7xl space-y-6'
          : 'w-full space-y-4'
      }
    >
      {variant === 'page' ? (
        <PageHeader
          title="Catálogo"
          description={`Productos de ${pharmacyName}`}
          actions={actions}
        />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Catálogo de productos
            </h3>
            <p className="text-sm text-muted-foreground">
              {products.length} producto{products.length === 1 ? '' : 's'} ·{' '}
              {pharmacyName}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      )}

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      {products.length === 0 && !loadError ? (
        <EmptyState
          icon={Package}
          title="Todavía no hay productos"
          description={
            isGeneric
              ? 'En modalidad genérica el catálogo llega desde el maestro FarmaFácil (preparación comercial o sync).'
              : 'Importa tu catálogo desde Excel/CSV o crea el primer producto manualmente.'
          }
          action={
            isGeneric || !ui.canCreateOrImport ? undefined : (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload className="h-4 w-4" /> Importar catálogo
                </Button>
                <Button
                  type="button"
                  className="gap-1.5"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Añadir primer producto
                </Button>
              </div>
            )
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, SKU, EAN o marca…"
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                <SelectItem value={PENDING_CLASSIFICATION_NAME}>
                  {PENDING_CLASSIFICATION_NAME}
                </SelectItem>
                {categoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) =>
                setStatus(v as 'all' | 'active' | 'inactive' | 'pending')
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Archivados</SelectItem>
                <SelectItem value="pending">Pend. clasificar</SelectItem>
              </SelectContent>
            </Select>
            {!isGeneric ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10"
                onClick={() => setShowStockColumn((v) => !v)}
              >
                {showStockColumn ? 'Ocultar stock' : 'Mostrar stock'}
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>
              {filtered.length} producto{filtered.length === 1 ? '' : 's'} ·
              página {Math.min(page, pageCount)} / {pageCount}
              {selected.size > 0 ? ` · ${selected.size} seleccionados` : ''}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                Siguiente
              </Button>
            </div>
          </div>

          {selected.size > 0 && showWriteActions && !isGeneric ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => void bulkArchive(false)}
              >
                <Archive className="h-4 w-4" /> Archivar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => void bulkArchive(true)}
              >
                <ArchiveRestore className="h-4 w-4" /> Reactivar
              </Button>
              <Select onValueChange={(v) => void bulkCategorize(v)}>
                <SelectTrigger className="h-8 w-[220px]">
                  <SelectValue placeholder="Categorizar masivo…" />
                </SelectTrigger>
                <SelectContent>
                  {taxonomyCats.map((c) => (
                    <SelectItem key={c.slug} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {showWriteActions && !isGeneric ? (
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            paged.length > 0 &&
                            paged.every((p) => selected.has(p.id))
                          }
                          onCheckedChange={() => toggleSelectPage()}
                          aria-label="Seleccionar página"
                        />
                      </TableHead>
                    ) : null}
                    <TableHead>Producto</TableHead>
                    <TableHead className="hidden md:table-cell">Código</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Categoría
                    </TableHead>
                    {!isGeneric ? (
                      <>
                        <TableHead className="text-right">PVP</TableHead>
                        {showStockColumn ? (
                          <TableHead className="text-right">Stock</TableHead>
                        ) : null}
                      </>
                    ) : (
                      <TableHead className="hidden sm:table-cell">
                        Disponibilidad
                      </TableHead>
                    )}
                    <TableHead>Estado</TableHead>
                    {showWriteActions ? (
                      <TableHead className="text-right">Acciones</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={isGeneric ? 5 : 8}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No hay productos con estos filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paged.map((p) => (
                      <TableRow key={p.id} className={!p.isActive ? 'opacity-60' : undefined}>
                        {showWriteActions && !isGeneric ? (
                          <TableCell>
                            <Checkbox
                              checked={selected.has(p.id)}
                              onCheckedChange={() => toggleSelect(p.id)}
                              aria-label={`Seleccionar ${p.name}`}
                            />
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {p.name}
                            </p>
                            {p.brand && !isGeneric ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {p.brand}
                              </p>
                            ) : null}
                            {isGeneric && p.subcategory ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {p.subcategory}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="space-y-0.5 text-xs text-muted-foreground">
                            {p.sku ? <p>SKU: {p.sku}</p> : null}
                            {p.ean ? <p>EAN: {p.ean}</p> : null}
                            {!p.sku && !p.ean ? <p>—</p> : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {p.category ?? '—'}
                        </TableCell>
                        {!isGeneric ? (
                          <>
                            <TableCell className="text-right font-medium">
                              {p.price === 0
                                ? formatCatalogPriceLabel(0)
                                : formatCurrency(p.price)}
                            </TableCell>
                            {showStockColumn ? (
                              <TableCell className="text-right">
                                <span className="text-muted-foreground">
                                  {formatNumber(p.stock)}
                                </span>
                              </TableCell>
                            ) : null}
                          </>
                        ) : (
                          <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                            {p.availabilityStatus === 'confirm_with_pharmacy'
                              ? 'Confirmar en farmacia'
                              : p.availabilityStatus ?? '—'}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant={p.isActive ? 'secondary' : 'outline'}>
                            {p.isActive ? 'Activo' : 'Archivado'}
                          </Badge>
                        </TableCell>
                        {showWriteActions ? (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {(ui.canEditCommercial || ui.canEditStock) &&
                              (ui.canEditCommercial || !isGeneric) ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditing(p);
                                    setFormOpen(true);
                                  }}
                                  aria-label={
                                    ui.canEditCommercial
                                      ? 'Editar'
                                      : 'Actualizar stock'
                                  }
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {ui.canToggleActive ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  disabled={busyId === p.id}
                                  onClick={() => void toggleActive(p)}
                                  aria-label={
                                    p.isActive ? 'Archivar' : 'Reactivar'
                                  }
                                >
                                  {p.isActive ? (
                                    <Archive className="h-4 w-4" />
                                  ) : (
                                    <ArchiveRestore className="h-4 w-4" />
                                  )}
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {!isGeneric && showWriteActions ? (
        <ProductFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          pharmacyId={pharmacyId}
          product={editing}
          writeCapability={writeCapability}
        />
      ) : null}
      {!isGeneric && ui.canCreateOrImport ? (
        <ProductImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          pharmacyId={pharmacyId}
        />
      ) : null}
    </div>
  );
}
