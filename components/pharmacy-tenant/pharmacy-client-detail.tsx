import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import type {
  PharmacyClientListItem,
  PharmacyClientOrderRow,
} from '@/lib/pharmacies/pharmacy-clients';
import {
  ORDER_SOURCE_LABELS,
  ORDER_STATUS_LABELS,
  formatOrderAmount,
} from '@/lib/orders/labels';
import type { OrderSource, OrderStatus } from '@/lib/orders/types';
import { tenantHref } from '@/lib/pharmacies/tenant-nav';
import { formatDate, formatDateTime } from '@/lib/format';

function statusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderStatus] ?? status;
}

function sourceLabel(source: string): string {
  return ORDER_SOURCE_LABELS[source as OrderSource] ?? source;
}

export function PharmacyClientDetail({
  pharmacyId,
  client,
  orders,
}: {
  pharmacyId: string;
  client: PharmacyClientListItem;
  orders: PharmacyClientOrderRow[];
}) {
  return (
    <div className="space-y-6">
      <Link
        href={tenantHref(pharmacyId, 'clientes')}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a clientes
      </Link>

      <div className="rounded-xl border border-border bg-card px-5 py-4">
        <h2 className="text-lg font-semibold text-foreground">
          {client.displayName}
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Teléfono</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {client.phone ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Vinculado desde</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {formatDate(client.firstLinkedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Último pedido</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {formatDateTime(client.lastOrderAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Pedidos en esta farmacia</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {client.orderCount}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Datos facilitados en pedidos de esta farmacia. No se muestran
          pedidos ni datos de otras farmacias.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Origen</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr
                key={o.id}
                className="border-b border-border/70 last:border-0"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  #{o.displayNumber}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDateTime(o.createdAt)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {sourceLabel(o.source)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {statusLabel(o.status)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-foreground">
                  {formatOrderAmount({
                    amount: o.totalAmount,
                    currency: o.currency,
                    source: o.source as OrderSource,
                    orderStatus: o.status as OrderStatus,
                    amountConfirmedAt: o.amountConfirmedAt,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
