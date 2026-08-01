import { Pill } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export default function CatalogoPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Catálogo"
        description="Productos, categorías y control de stock"
      />
      <ModulePlaceholder
        icon={Pill}
        title="Módulo de Catálogo"
        description="Listado en tarjetas y tabla, categorías, productos destacados, control de stock e importación desde Excel. Se desarrollará en la Fase 2."
      />
    </div>
  );
}
