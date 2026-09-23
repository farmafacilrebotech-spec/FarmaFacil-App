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
import { setPharmacyProductActiveAction } from '@/app/f/[pharmacyId]/catalogo/actions';
import { ProductFormDialog } from '@/components/pharmacy-catalog/product-form-dialog';
import { ProductImportDialog } from '@/components/pharmacy-catalog/product-import-dialog';
import { buildProductTemplateCsv } from '@/lib/pharmacies/product-import';

export function PharmacyCatalogView({
  pharmacyId,
  pharmacyName,
  products,
  categories,
  loadError,
}: {
  pharmacyId: string;
  pharmacyName: string;
  products: PharmacyProduct[];
  categories: string[];
  loadError?: string | null;
}) {
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [status, setStatus] = React.useState<'all' | 'active' | 'inactive'>(
    'all'
  );
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PharmacyProduct | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (status === 'active' && !p.isActive) return false;
      if (status === 'inactive' && p.isActive) return false;
      if (category !== 'all' && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku?.toLowerCase().includes(q) ?? false) ||
        (p.ean?.toLowerCase().includes(q) ?? false) ||
        (p.brand?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [products, query, category, status]);

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

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        title="Catálogo"
        description={`Productos de ${pharmacyName}`}
        actions={
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
        }
      />

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      {products.length === 0 && !loadError ? (
        <EmptyState
          icon={Package}
          title="Todavía no hay productos"
          description="Importa tu catálogo desde Excel/CSV o crea el primer producto manualmente."
          action={
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
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(v) =>
                setStatus(v as 'all' | 'active' | 'inactive')
              }
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Archivados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="hidden md:table-cell">Código</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Categoría
                    </TableHead>
                    <TableHead className="text-right">PVP</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        No hay productos con estos filtros.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((p) => (
                      <TableRow key={p.id} className={!p.isActive ? 'opacity-60' : undefined}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {p.name}
                            </p>
                            {p.brand ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {p.brand}
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
                        <TableCell className="text-right font-medium">
                          {formatCurrency(p.price)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              p.stock <= p.minStock
                                ? 'font-medium text-amber-600'
                                : undefined
                            }
                          >
                            {formatNumber(p.stock)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.isActive ? 'secondary' : 'outline'}>
                            {p.isActive ? 'Activo' : 'Archivado'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditing(p);
                                setFormOpen(true);
                              }}
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        pharmacyId={pharmacyId}
        product={editing}
      />
      <ProductImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        pharmacyId={pharmacyId}
      />
    </div>
  );
}
