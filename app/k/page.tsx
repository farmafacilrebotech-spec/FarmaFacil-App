import Link from 'next/link';

import { requireValidKioskDeviceSession } from '@/lib/kiosk/device-session';
import { loadKioskHomeContext } from '@/lib/kiosk/home-context';
import { BrandLogo } from '@/components/brand';
import { KioskWelcomeScreen } from '@/components/kiosk/kiosk-welcome-screen';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

/**
 * Pantalla principal del kiosko (sesión de dispositivo válida).
 * Sin login de cliente. Sin panel de gestión.
 */
export default async function KioskHomePage() {
  const session = await requireValidKioskDeviceSession();

  if (!session.ok) {
    const isCommercial = session.reason === 'commercially_blocked';
    const isRevoked = session.reason === 'revoked';

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#2EC4C7] px-4">
        <BrandLogo size={96} />
        <div className="mt-8 max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-semibold text-slate-900">
            {isCommercial
              ? 'Acceso temporalmente no disponible'
              : isRevoked
                ? 'Dispositivo revocado'
                : 'Tablet no vinculada'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isCommercial
              ? 'La farmacia no tiene activo el servicio de kiosko en este momento. La vinculación se mantiene; el acceso se restablecerá cuando el servicio vuelva a estar disponible.'
              : isRevoked
                ? 'Este dispositivo ha sido revocado. Solicita un código nuevo en el panel de la farmacia.'
                : 'No hay una sesión de kiosko válida en este dispositivo.'}
          </p>
          {!isCommercial ? (
            <Button asChild className="mt-6 w-full rounded-2xl py-6 text-base">
              <Link href="/k/pair">Ir a vincular</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const home = await loadKioskHomeContext(session.session);
  return <KioskWelcomeScreen home={home} />;
}
