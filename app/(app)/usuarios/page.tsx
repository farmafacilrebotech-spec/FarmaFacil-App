import { UserCog } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

/**
 * Listado global de usuarios de plataforma — pendiente de datos reales.
 * No muestra mocks de demo (Farmacia Central, etc.).
 */
export default function UsuariosPage() {
  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6">
      <PageHeader
        title="Usuarios"
        description="Gestión de usuarios de la plataforma FarmaFácil"
      />
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center shadow-soft">
        <UserCog className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          Listado de usuarios en preparación
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          Esta vista dejará de usar datos de demostración. Mientras tanto,
          gestiona usuarios de cada farmacia desde su ficha o panel de
          miembros.
        </p>
      </Card>
    </div>
  );
}
