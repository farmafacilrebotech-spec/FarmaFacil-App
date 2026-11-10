import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { listSaOrders } from '@/lib/platform/sa-orders';

export const dynamic = 'force-dynamic';

export default async function PedidosPage() {
  const listed = await listSaOrders(100);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Pedidos"
        description="Pedidos reales de farmacias (solo lectura SuperAdmin)."
      />

      {!listed.ok ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {listed.error}
        </p>
      ) : listed.orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay pedidos registrados todavía.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Farmacia</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Importe</th>
              </tr>
            </thead>
            <tbody>
              {listed.orders.map((o) => (
                <tr key={o.id} className="border-b border-border/70">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {o.createdAt
                      ? new Date(o.createdAt).toLocaleString('es-ES')
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/farmacias/${o.pharmacyId}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {o.pharmacyName ?? o.pharmacyId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{o.status}</td>
                  <td className="px-3 py-2">{o.customerName ?? '—'}</td>
                  <td className="px-3 py-2">
                    {o.totalAmount == null
                      ? '—'
                      : new Intl.NumberFormat('es-ES', {
                          style: 'currency',
                          currency: 'EUR',
                        }).format(o.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShoppingCart className="h-3.5 w-3.5" />
        Gestión operativa del pedido en el panel de cada farmacia (/f/…/pedidos).
      </p>
    </div>
  );
}
