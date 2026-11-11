import { Users } from 'lucide-react';

import { PharmacyClientsPanel } from '@/components/pharmacy-tenant/pharmacy-clients-panel';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { listPharmacyLinkedClients } from '@/lib/pharmacies/pharmacy-clients';
import { requirePharmacyClientsAccess } from '@/lib/pharmacies/pharmacy-clients-access';

export const dynamic = 'force-dynamic';

export default async function PharmacyClientesPage({
  params,
}: {
  params: { pharmacyId: string };
}) {
  const pharmacyId = params.pharmacyId;
  const gate = await requirePharmacyClientsAccess(pharmacyId);

  if (!gate.ok) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Clientes"
          description="Clientes con pedidos vinculados a esta farmacia"
        />
        <EmptyState
          icon={Users}
          title="Sin acceso a clientes"
          description={gate.error}
        />
      </div>
    );
  }

  const listed = await listPharmacyLinkedClients(pharmacyId, 100);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Clientes"
        description="Clientes con pedidos vinculados a esta farmacia"
      />
      {!listed.ok ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {listed.error}
        </p>
      ) : (
        <PharmacyClientsPanel pharmacyId={pharmacyId} clients={listed.clients} />
      )}
    </div>
  );
}
