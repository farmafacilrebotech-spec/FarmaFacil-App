import { redirect } from 'next/navigation';

import { requireValidKioskDeviceSession } from '@/lib/kiosk/device-session';
import { KioskComingSoon } from '@/components/kiosk/kiosk-coming-soon';

export const dynamic = 'force-dynamic';

export default async function KioskCartPage() {
  const session = await requireValidKioskDeviceSession();
  if (!session.ok) {
    redirect(session.reason === 'commercially_blocked' ? '/k' : '/k/pair');
  }

  return (
    <KioskComingSoon
      title="Mi carrito"
      description="El carrito y la impresión de ticket se conectarán cuando el catálogo táctil esté listo. La infraestructura de pedidos ya existe en el servidor."
    />
  );
}
