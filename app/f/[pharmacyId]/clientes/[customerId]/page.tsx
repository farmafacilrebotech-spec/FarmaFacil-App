import { Users } from 'lucide-react';

import { PharmacyClientDetail } from '@/components/pharmacy-tenant/pharmacy-client-detail';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { getPharmacyLinkedClientDetail } from '@/lib/pharmacies/pharmacy-clients';
import { requirePharmacyClientsAccess } from '@/lib/pharmacies/pharmacy-clients-access';

export const dynamic = 'force-dynamic';

export default async function PharmacyClienteDetailPage({
  params,
}: {
  params: { pharmacyId: string; customerId: string };
}) {
  const { pharmacyId, customerId } = params;
  const gate = await requirePharmacyClientsAccess(pharmacyId);

  if (!gate.ok) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader title="Cliente" description="Ficha de cliente de esta farmacia" />
        <EmptyState
          icon={Users}
          title="Sin acceso a clientes"
          description={gate.error}
        />
      </div>
    );
  }

  const detail = await getPharmacyLinkedClientDetail(pharmacyId, customerId);

  if (!detail.ok) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader title="Cliente" description="Ficha de cliente de esta farmacia" />
        <EmptyState
          icon={Users}
          title="Cliente no disponible"
          description={detail.error}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={detail.client.displayName}
        description="Pedidos vinculados exclusivamente a esta farmacia"
      />
      <PharmacyClientDetail
        pharmacyId={pharmacyId}
        client={detail.client}
        orders={detail.orders}
      />
    </div>
  );
}
