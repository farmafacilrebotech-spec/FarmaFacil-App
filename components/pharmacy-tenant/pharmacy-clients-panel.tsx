import Link from 'next/link';
import { Users } from 'lucide-react';

import type { PharmacyClientListItem } from '@/lib/pharmacies/pharmacy-clients';
import { tenantHref } from '@/lib/pharmacies/tenant-nav';
import { formatDate, formatDateTime } from '@/lib/format';
import { EmptyState } from '@/components/shared/empty-state';

export function PharmacyClientsPanel({
  pharmacyId,
  clients,
}: {
  pharmacyId: string;
  clients: PharmacyClientListItem[];
}) {
  if (clients.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Aún no hay clientes vinculados"
        description="Solo aparecen clientes que han realizado un pedido vinculado a esta farmacia. Visitar el QR o guardar la farmacia en «Mis farmacias» no autoriza compartir datos personales."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {clients.length === 1
          ? '1 cliente con pedidos vinculados a esta farmacia.'
          : `${clients.length} clientes con pedidos vinculados a esta farmacia.`}{' '}
        Solo se muestran datos facilitados en esos pedidos.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Vinculado desde</th>
              <th className="px-4 py-3 font-medium">Último pedido</th>
              <th className="px-4 py-3 font-medium text-right">Pedidos</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr
                key={c.customerProfileId}
                className="border-b border-border/70 last:border-0"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`${tenantHref(pharmacyId, 'clientes')}/${c.customerProfileId}`}
                    className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                  >
                    {c.displayName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.phone ?? '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(c.firstLinkedAt)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDateTime(c.lastOrderAt)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-foreground">
                  {c.orderCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
