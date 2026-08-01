import { ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export default function PedidosPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Pedidos"
        description="Todos los pedidos con sus estados y detalle"
      />
      <ModulePlaceholder
        icon={ShoppingCart}
        title="Módulo de Pedidos"
        description="Tabla profesional con estados (pendiente, preparación, preparado, entregado, cancelado), detalle del pedido, productos e importe. Se desarrollará en la Fase 2."
      />
    </div>
  );
}
