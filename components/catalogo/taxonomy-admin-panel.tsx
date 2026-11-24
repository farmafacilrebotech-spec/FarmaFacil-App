'use client';

import Image from 'next/image';
import type { FfTaxonomyCategory } from '@/lib/catalog/taxonomy';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/**
 * Gestión visual de taxonomía.
 * Persistencia en BD requiere apply de supabase/proposed/106 (no aplicado en staging).
 * Mientras tanto la fuente de verdad es el seed TypeScript.
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
  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        Seed en código (`lib/catalog/taxonomy.ts`) alineado con migración
        propuesta 106. La edición persistente en BD se activará tras autorizar
        el apply en entorno aislado — no altera staging actual.
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
