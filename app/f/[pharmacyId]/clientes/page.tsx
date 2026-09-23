import { Users } from 'lucide-react';

import { PharmacyTenantModulePage } from '@/components/pharmacy-tenant/pharmacy-tenant-module-page';

export const dynamic = 'force-dynamic';

export default function PharmacyClientesPage() {
  return (
    <PharmacyTenantModulePage
      title="Clientes"
      description="Base de clientes de tu farmacia"
      icon={Users}
      moduleTitle="Módulo de Clientes"
      moduleDescription="Ficha de cliente, historial de pedidos e importación. Se conectará a los clientes reales de esta farmacia en una fase posterior."
    />
  );
}
