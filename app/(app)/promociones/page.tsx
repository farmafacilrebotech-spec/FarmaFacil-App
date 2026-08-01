import { Tag } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export default function PromocionesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Promociones"
        description="Campañas, descuentos y ofertas activas"
      />
      <ModulePlaceholder
        icon={Tag}
        title="Módulo de Promociones"
        description="Creación y gestión de campañas promocionales, descuentos por producto o categoría, y programación de ofertas. Se desarrollará en la Fase 2."
      />
    </div>
  );
}
