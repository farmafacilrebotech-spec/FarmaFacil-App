import { Tag } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';

export const dynamic = 'force-dynamic';

/**
 * No hay tablas/RPCs de promociones en main.
 * No inventamos campañas ni reutilizamos otro módulo con otra etiqueta.
 */
export default function PromocionesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Promociones"
        description="Supervisión SuperAdmin de campañas de farmacia."
      />
      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <Tag className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">Módulo sin esquema en producción</p>
            <p className="text-muted-foreground">
              No existe tabla de promociones ni panel de farmacia operativo que
              reutilizar. La entrada del menú se mantiene para no fingir otro
              módulo. Desarrollo dedicado (migración + RLS + UI farmacia +
              supervisión SA) pendiente de autorización aparte.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
