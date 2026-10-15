import Link from 'next/link';
import { MonitorSmartphone } from 'lucide-react';

import { requireValidKioskDeviceSession } from '@/lib/kiosk/device-session';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

/**
 * Estado mínimo del runtime kiosko tras emparejar.
 * Fase 1: confirma sesión; catálogo táctil llega en fase posterior.
 */
export default async function KioskHomePage() {
  const session = await requireValidKioskDeviceSession();

  if (!session.ok) {
    const isCommercial = session.reason === 'commercially_blocked';
    const isRevoked = session.reason === 'revoked';

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <BrandLogo size={96} showTagline />
        <div className="mt-8 max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft-lg">
          <h1 className="text-xl font-semibold text-foreground">
            {isCommercial
              ? 'Acceso temporalmente no disponible'
              : isRevoked
                ? 'Dispositivo revocado'
                : 'Tablet no vinculada'}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isCommercial
              ? 'La farmacia no tiene activo el servicio de kiosko en este momento. La vinculación se mantiene; el acceso se restablecerá cuando el servicio vuelva a estar disponible.'
              : isRevoked
                ? 'Este dispositivo ha sido revocado. Solicita un código nuevo en el panel de la farmacia.'
                : 'No hay una sesión de kiosko válida en este dispositivo.'}
          </p>
          {!isCommercial ? (
            <Button asChild className="mt-6">
              <Link href="/k/pair">Ir a vincular</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <BrandLogo size={96} showTagline />
      <div className="mt-8 max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-soft-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MonitorSmartphone className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-foreground">
          Kiosko vinculado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dispositivo «{session.session.displayName}» conectado a la farmacia.
          El catálogo táctil y los pedidos se activarán en la siguiente fase.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          Esta pantalla no da acceso al panel de gestión.
        </p>
      </div>
    </div>
  );
}
