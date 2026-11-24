'use client';

import * as React from 'react';
import Image from 'next/image';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type {
  FfTaxonomyCategory,
  FfTaxonomySubcategory,
} from '@/lib/catalog/taxonomy';
import { listSubcategoriesForCategory } from '@/lib/catalog/taxonomy';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

/**
 * Gestión visual de taxonomía + subcategorías.
 * Persistencia BD requiere apply de supabase/proposed/089 (no en staging).
 * Seed TS es la fuente de verdad hasta entonces; borradores locales en sesión.
 */
export function TaxonomyAdminPanel({
  commercial,
  internal,
  legacyAliases,
}: {
  commercial: readonly FfTaxonomyCategory[];
  internal: readonly FfTaxonomyCategory[];
  legacyAliases: Array<{ legacy: string; slug: string }>;
}) {
  const [subs, setSubs] = React.useState<FfTaxonomySubcategory[]>(() =>
    commercial.flatMap((c) => listSubcategoriesForCategory(c.slug))
  );
  const [newCatSlug, setNewCatSlug] = React.useState(
    commercial[0]?.slug ?? ''
  );
  const [newName, setNewName] = React.useState('');
  const [newSlug, setNewSlug] = React.useState('');

  function addSubcategory() {
    const name = newName.trim();
    const slug = newSlug.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name || !slug || !newCatSlug) {
      toast.error('Completa categoría, nombre y slug.');
      return;
    }
    if (subs.some((s) => s.categorySlug === newCatSlug && s.slug === slug)) {
      toast.error('Ya existe esa subcategoría.');
      return;
    }
    setSubs((prev) => [
      ...prev,
      {
        categorySlug: newCatSlug,
        slug,
        name,
        sortOrder: (prev.filter((s) => s.categorySlug === newCatSlug).length + 1) * 10,
      },
    ]);
    setNewName('');
    setNewSlug('');
    toast.message(
      'Subcategoría añadida en borrador de sesión. Persistencia BD → apply 089.'
    );
  }

  function removeSub(categorySlug: string, slug: string) {
    setSubs((prev) =>
      prev.filter(
        (s) => !(s.categorySlug === categorySlug && s.slug === slug)
      )
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Seed en código (`lib/catalog/taxonomy.ts`) alineado con migración
        propuesta <strong>089</strong>. La edición persistente en BD se
        activará tras autorizar el apply en entorno aislado — no altera
        staging actual.
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Categorías comerciales ({commercial.length})
        </h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Icono</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="w-24">Orden</TableHead>
                <TableHead className="w-28">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commercial.map((c) => (
                <TableRow key={c.slug}>
                  <TableCell>
                    {c.iconSrc ? (
                      <Image
                        src={c.iconSrc}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7"
                      />
                    ) : (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {c.slug}
                  </TableCell>
                  <TableCell>{c.sortOrder}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">active</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Subcategorías ({subs.length})
        </h2>
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-border p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select value={newCatSlug} onValueChange={setNewCatSlug}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {commercial.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nombre</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Limpieza facial"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="facial_limpieza"
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={addSubcategory} className="gap-1">
              <Plus className="h-4 w-4" />
              Añadir
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead>Subcategoría</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((s) => {
                const parent = commercial.find((c) => c.slug === s.categorySlug);
                return (
                  <TableRow key={`${s.categorySlug}:${s.slug}`}>
                    <TableCell>{parent?.name ?? s.categorySlug}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {s.slug}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => removeSub(s.categorySlug, s.slug)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Estados internos (no comerciales)
        </h2>
        <ul className="space-y-2">
          {internal.map((c) => (
            <li
              key={c.slug}
              className="flex items-center justify-between rounded-lg border border-dashed border-border px-4 py-3 text-sm"
            >
              <span>
                <span className="font-medium">{c.name}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {c.slug}
                </span>
              </span>
              <Badge variant="outline">internal · no visible en kiosko</Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Alias de conservación (maestro 8 → taxonomía 26)
        </h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría legacy</TableHead>
                <TableHead>Slug destino</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {legacyAliases.map((a) => (
                <TableRow key={a.legacy}>
                  <TableCell>{a.legacy}</TableCell>
                  <TableCell className="font-mono text-xs">{a.slug}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
