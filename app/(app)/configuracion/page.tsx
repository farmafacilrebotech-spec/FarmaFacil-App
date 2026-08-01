import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { ModulePlaceholder } from '@/components/shared/module-placeholder';

export default function ConfiguracionPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Configuración"
        description="Ajustes de tu cuenta y de la plataforma"
      />
      <ModulePlaceholder
        icon={Settings}
        title="Módulo de Configuración"
        description="Logo, colores, horario, datos de la farmacia, mensajes, QR y gestión de usuarios. Se desarrollará en la Fase 4."
      />
    </div>
  );
}
