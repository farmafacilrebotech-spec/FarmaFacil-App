'use client';

import * as React from 'react';
import { Loader2, RefreshCw, Pencil, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import type {
  MasterCatalogProduct,
  PharmacyCatalogSummary,
} from '@/lib/commercial/master-catalog-queries';
import {
  syncMasterCatalogAction,
  updateMasterCatalogProductAction,
} from '@/app/(app)/tarifas/actions';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from '@/components/ui/switch';

export function MasterCatalogPanel({
  products,
  categories,
  activeCount,
  pharmacyRows,
  loadError,
  pharmaciesError,
  canWrite,
}: {
  products: MasterCatalogProduct[];
  categories: string[];
  activeCount: number;
  pharmacyRows: PharmacyCatalogSummary[];
  loadError?: string | null;
  pharmaciesError?: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const mutationLock = React.useRef(false);
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('all');
  const [syncing, setSyncing] = React.useState(false);
  const [editing, setEditing] = React.useState<MasterCatalogProduct | null>(
    null
  );
  const [editName, setEditName] = React.useState('');
  const [editCategory, setEditCategory] = React.useState('');
  const [editSub, setEditSub] = React.useState('');
  const [editActive, setEditActive] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== 'all' && p.categoryName !== category) return false;
      if (!q) return true;
      return (
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.subcategoryName.toLowerCase().includes(q)
      );
    });
  }, [products, query, category]);

  function openEdit(p: MasterCatalogProduct) {
    setEditing(p);
    setEditName(p.name);
    setEditCategory(p.categoryName);
    setEditSub(p.subcategoryName);
    setEditActive(p.activeStandardCatalog);
  }

  async function saveEdit() {
    if (!editing || mutationLock.current) return;
    mutationLock.current = true;
    setSaving(true);
    try {
      const result = await updateMasterCatalogProductAction({
        id: editing.id,
        name: editName,
        categoryName: editCategory,
        subcategoryName: editSub,
        activeStandardCatalog: editActive,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Producto maestro actualizado.', {
        description: 'Usa «Sincronizar con farmacias generic» para propagar.',
      });
      setEditing(null);
      router.refresh();
    } finally {
      setSaving(false);
      mutationLock.current = false;
    }
  }

  async function onSyncAll() {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setSyncing(true);
    try {
      const result = await syncMasterCatalogAction(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success('Sincronización completada.', {
        description:
          result.updated != null
            ? `${result.updated} proyecciones actualizadas.`
            : undefined,
      });
      router.refresh();
    } finally {
      setSyncing(false);
      mutationLock.current = false;
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-dashed border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Catálogo maestro FarmaFácil ({activeCount}/100 activos)
            </p>
            <p>
              Tipos genéricos FF-GEN sin marca, PVP ni stock. Las farmacias en
              modalidad <span className="font-medium text-foreground">generic</span>{' '}
              reciben proyecciones; no pueden editar el maestro.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar FF-GEN, nombre o subcategoría…"
            className="max-w-md"
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!canWrite || syncing}
          onClick={() => void onSyncAll()}
        >
          {syncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Sincronizar con farmacias generic
        </Button>
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : (
        <Card className="overflow-hidden shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    ID
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Tipo genérico
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Categoría
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Subcategoría
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/70 last:border-0"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">{p.id}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {p.name}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {p.categoryName}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {p.subcategoryName}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        variant={
                          p.activeStandardCatalog ? 'secondary' : 'outline'
                        }
                      >
                        {p.activeStandardCatalog ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1"
                        disabled={!canWrite}
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden shadow-soft">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">
            Modalidad por farmacia
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            generic = proyección del maestro · own = catálogo propio
          </p>
        </div>
        {pharmaciesError ? (
          <p className="px-5 py-6 text-sm text-destructive">{pharmaciesError}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Farmacia
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Modalidad
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Activos
                  </th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">
                    Genéricos
                  </th>
                </tr>
              </thead>
              <tbody>
                {pharmacyRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      Sin farmacias.
                    </td>
                  </tr>
                ) : (
                  pharmacyRows.map((r) => (
                    <tr
                      key={r.pharmacyId}
                      className="border-b border-border/70 last:border-0"
                    >
                      <td className="px-4 py-2.5 font-medium">{r.pharmacyName}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline">{r.catalogMode}</Badge>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {r.activeProductCount}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {r.genericProductCount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {editing?.id}</DialogTitle>
            <DialogDescription>
              Solo SuperAdmin (platform.pharmacies.write). Tras guardar,
              sincroniza para actualizar farmacias generic.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tipo genérico</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subcategoría</Label>
              <Input
                value={editSub}
                onChange={(e) => setEditSub(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <Label htmlFor="master-active">Activo en catálogo estándar</Label>
              <Switch
                id="master-active"
                checked={editActive}
                onCheckedChange={setEditActive}
                disabled={saving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving || !editName.trim()}
              onClick={() => void saveEdit()}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
