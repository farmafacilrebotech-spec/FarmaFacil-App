import { redirect } from 'next/navigation';

import { requireValidKioskDeviceSession } from '@/lib/kiosk/device-session';
import { KioskComingSoon } from '@/components/kiosk/kiosk-coming-soon';

export const dynamic = 'force-dynamic';

export default async function KioskCatalogPage() {
  const session = await requireValidKioskDeviceSession();
  if (!session.ok) {
    redirect(session.reason === 'commercially_blocked' ? '/k' : '/k/pair');
  }

  return (
    <KioskComingSoon
      title="Buscar producto"
      description="El catálogo táctil del kiosko estará disponible en la siguiente fase. Los productos se mostrarán solo de la farmacia vinculada a esta tablet."
    />
  );
}
