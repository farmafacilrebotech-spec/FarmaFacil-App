import { redirect } from 'next/navigation';

import { KioskCartProvider } from '@/components/kiosk/kiosk-cart-provider';
import { KioskCartView } from '@/components/kiosk/kiosk-cart-view';
import { requireValidKioskDeviceSession } from '@/lib/kiosk/device-session';
import { loadKioskHomeContext } from '@/lib/kiosk/home-context';

export const dynamic = 'force-dynamic';

export default async function KioskCartPage() {
  const session = await requireValidKioskDeviceSession();
  if (!session.ok) {
    redirect(session.reason === 'commercially_blocked' ? '/k' : '/k/pair');
  }

  const home = await loadKioskHomeContext(session.session);

  return (
    <KioskCartProvider pharmacyId={session.session.pharmacyId}>
      <KioskCartView
        pharmacyName={home.pharmacyName || session.session.displayName}
      />
    </KioskCartProvider>
  );
}
