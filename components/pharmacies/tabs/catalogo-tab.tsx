'use client';

import * as React from 'react';
import { Plus, Upload, Package } from 'lucide-react';
import { pharmacyProducts, productCategories, productStatusLabels } from '@/lib/mock-data';
import { formatCurrency, formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge, toneForProductStatus } from '@/components/shared/status-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Star } from 'lucide-react';

export function CatalogoTab() {
  const [category, setCategory] = React.useState('all');
  const filtered = React.useMemo(
    () =>
      category === 'all'
        ? pharmacyProducts
        : pharmacyProducts.filter((p) => p.category === category),
    [category]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Catálogo de productos
          </h3>
          <p className="text-sm text-muted-foreground">
            {pharmacyProducts.length} productos · {productCategories.length} categorías
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Upload className="h-4 w-4" /> Importar Excel
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Nuevo producto
          </Button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCategory('all')}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            category === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/70'
          }`}
        >
          Todas
        </button>
        {productCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              category === cat
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Sin productos en esta categoría"
          description="No hay productos en la categoría seleccionada."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Producto
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                    SKU
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                    Categoría
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Precio
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Stock
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        {p.featured && (
                          <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                        )}
                        <span className="font-medium text-foreground">
                          {p.name}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3.5 font-mono text-xs text-muted-foreground md:table-cell">
                      {p.sku}
                    </td>
                    <td className="hidden px-4 py-3.5 text-muted-foreground md:table-cell">
                      {p.category}
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-foreground">
                      {formatCurrency(p.price)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-muted-foreground">
                      {formatNumber(p.stock)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge tone={toneForProductStatus(p.status)}>
                        {productStatusLabels[p.status]}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
