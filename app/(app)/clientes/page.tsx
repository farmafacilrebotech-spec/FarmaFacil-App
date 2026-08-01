import { Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export default function ClientesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Clientes"
        description="Base de clientes de todas tus farmacias"
      />
      <ModulePlaceholder
        icon={Users}
        title="Módulo de Clientes"
        description="Tabla completa con filtros, historial de pedidos, ficha de cliente e importación desde Excel. Se desarrollará en la Fase 2."
      />
    </div>
  );
}
