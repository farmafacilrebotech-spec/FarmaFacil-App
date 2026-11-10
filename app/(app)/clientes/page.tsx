import { Users } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { listSaCustomers } from '@/lib/platform/sa-customers';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  const listed = await listSaCustomers(100);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Clientes"
        description="Cuentas de cliente (PWA) con vínculo a farmacias guardadas. Solo SuperAdmin Total."
      />

      <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        No es un CRM de importación Excel. Solo perfiles con{' '}
        <code className="text-xs">account_kind</code> customer/both. Soporte y
        otros roles de plataforma no pueden consultar estos datos personales.
      </div>

      {!listed.ok ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {listed.error}
        </p>
      ) : listed.customers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay clientes registrados.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Farmacias guardadas</th>
              </tr>
            </thead>
            <tbody>
              {listed.customers.map((c) => (
                <tr key={c.id} className="border-b border-border/70">
                  <td className="px-3 py-2">{c.fullName ?? '—'}</td>
                  <td className="px-3 py-2">{c.email}</td>
                  <td className="px-3 py-2">{c.accountKind}</td>
                  <td className="px-3 py-2">{c.savedPharmacyCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        Clientes por farmacia: pestaña Clientes de la ficha (aislamiento por
        pharmacy_id vía farmacias guardadas).
      </p>
    </div>
  );
}
