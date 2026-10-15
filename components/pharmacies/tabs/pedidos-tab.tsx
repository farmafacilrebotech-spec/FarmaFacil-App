'use client';

import { ShoppingCart } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';

/** Pedidos reales aún no conectados — sin datos de demostración. */
export function PedidosTab() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">
          Pedidos de la farmacia
        </h3>
        <p className="text-sm text-muted-foreground">
          Los pedidos operativos se mostrarán cuando el módulo esté conectado.
        </p>
      </div>
      <EmptyState
        icon={ShoppingCart}
        title="Sin pedidos"
        description="No hay datos ficticios. Esta pestaña esperará al módulo de pedidos real."
      />
    </div>
  );
}
