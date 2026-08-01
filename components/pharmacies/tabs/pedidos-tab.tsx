'use client';

import * as React from 'react';
import { ShoppingCart } from 'lucide-react';
import { pharmacyOrders, orderStatusLabels } from '@/lib/mock-data';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge, toneForOrderStatus } from '@/components/shared/status-badge';

const statusFilters = ['all', 'pending', 'preparing', 'prepared', 'delivered', 'cancelled'];

export function PedidosTab() {
  const [filter, setFilter] = React.useState('all');
  const filtered = React.useMemo(
    () =>
      filter === 'all'
        ? pharmacyOrders
        : pharmacyOrders.filter((o) => o.status === filter),
    [filter]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Pedidos de la farmacia
          </h3>
          <p className="text-sm text-muted-foreground">
            {pharmacyOrders.length} pedidos registrados
          </p>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {s === 'all' ? 'Todos' : orderStatusLabels[s]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Sin pedidos con este estado"
          description="No hay pedidos que coincidan con el filtro seleccionado."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pedido
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cliente
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                    Fecha
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                    Artículos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Importe
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr
                    key={o.id}
                    className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                  >
                    <td className="px-4 py-3.5 font-medium text-foreground">
                      {o.code}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {o.clientName}
                    </td>
                    <td className="hidden px-4 py-3.5 text-muted-foreground md:table-cell">
                      {formatDateTime(o.createdAt)}
                    </td>
                    <td className="hidden px-4 py-3.5 text-right text-muted-foreground md:table-cell">
                      {o.items}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge tone={toneForOrderStatus(o.status)}>
                        {orderStatusLabels[o.status]}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3.5 text-right font-medium text-foreground">
                      {formatCurrency(o.total)}
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
