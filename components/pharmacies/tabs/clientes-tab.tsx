'use client';

import { Users } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import type { SaCustomerRow } from '@/lib/platform/sa-customers';

export function ClientesTab({
  customers,
  error,
}: {
  customers: SaCustomerRow[];
  error: string | null;
}) {
  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">No se pudieron cargar los clientes</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Sin clientes vinculados"
        description="Esta farmacia aún no tiene clientes asociados en el sistema."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">Clientes</h3>
        <p className="text-sm text-muted-foreground">
          Clientes vinculados a esta farmacia ({customers.length}). Solo lectura SuperAdmin.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Tipo cuenta</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-border/70 last:border-0">
                <td className="px-4 py-3 font-medium text-foreground">
                  {c.fullName?.trim() || '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.email || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.accountKind || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
