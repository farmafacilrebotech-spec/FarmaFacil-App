import Link from 'next/link';
import { ArrowLeft, UserCog } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

/**
 * Detalle de usuario de plataforma — sin mocks de demo.
 */
export default function UsuarioDetailPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="gap-1.5">
        <Link href="/usuarios">
          <ArrowLeft className="h-4 w-4" /> Volver a usuarios
        </Link>
      </Button>
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center shadow-soft">
        <UserCog className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          Ficha de usuario no disponible
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          Esta pantalla ya no muestra datos ficticios. La gestión real de
          usuarios de farmacia está en el panel de cada establecimiento.
        </p>
      </Card>
    </div>
  );
}
