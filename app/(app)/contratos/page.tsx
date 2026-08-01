import { FileText } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export default function ContratosPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Contratos"
        description="Contratos, firmas y renovaciones"
      />
      <ModulePlaceholder
        icon={FileText}
        title="Módulo de Contratos"
        description="Listado de contratos, vista PDF simulada, estado, firma digital y gestión de renovaciones. Se desarrollará en la Fase 4."
      />
    </div>
  );
}
