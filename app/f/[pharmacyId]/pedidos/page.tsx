import { ShoppingCart } from 'lucide-react';

import { PharmacyTenantModulePage } from '@/components/pharmacy-tenant/pharmacy-tenant-module-page';

export const dynamic = 'force-dynamic';

export default function PharmacyPedidosPage() {
  return (
    <PharmacyTenantModulePage
      title="Pedidos"
      description="Pedidos de tu farmacia con estados y detalle"
      icon={ShoppingCart}
      moduleTitle="Módulo de Pedidos"
      moduleDescription="Tabla de pedidos, estados (pendiente, preparación, preparado, entregado, cancelado) y detalle. Se conectará a datos reales de esta farmacia en una fase posterior."
    />
  );
}
