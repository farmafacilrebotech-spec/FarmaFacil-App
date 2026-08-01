import { LifeBuoy } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export default function AyudaPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Centro de ayuda"
        description="Guías, documentación y soporte"
      />
      <ModulePlaceholder
        icon={LifeBuoy}
        title="Centro de ayuda"
        description="Artículos, tutoriales y contacto con el equipo de soporte de FarmaFácil. Próximamente disponible."
      />
    </div>
  );
}
