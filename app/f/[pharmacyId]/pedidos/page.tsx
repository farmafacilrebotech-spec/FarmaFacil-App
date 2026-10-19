import { PharmacyOrdersPanel } from '@/components/pharmacy-tenant/pharmacy-orders-panel';
import { PageHeader } from '@/components/shared/page-header';
import { requireOrdersManage, requireOrdersView } from '@/lib/orders/authz';
import { listPharmacyOrders } from '@/lib/orders/queries';

export const dynamic = 'force-dynamic';

export default async function PharmacyPedidosPage({
  params,
}: {
  params: { pharmacyId: string };
}) {
  const pharmacyId = params.pharmacyId;
  const view = await requireOrdersView(pharmacyId);

  if (!view.ok) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Pedidos"
          description="Pedidos de tu farmacia con estados y detalle"
        />
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
          {view.error}
        </p>
      </div>
    );
  }

  const manage = await requireOrdersManage(pharmacyId);
  const listed = await listPharmacyOrders(pharmacyId, { limit: 80 });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Pedidos"
        description="Cola operativa y cobro en mostrador de esta farmacia"
      />

      {!listed.ok ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {listed.error}
        </p>
      ) : (
        <PharmacyOrdersPanel
          pharmacyId={pharmacyId}
          initialOrders={listed.orders}
          canManage={manage.ok}
        />
      )}
    </div>
  );
}
