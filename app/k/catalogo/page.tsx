import { redirect } from 'next/navigation';

import { KioskCartProvider } from '@/components/kiosk/kiosk-cart-provider';
import { KioskCatalogView } from '@/components/kiosk/kiosk-catalog-view';
import { searchKioskCatalog } from '@/lib/kiosk/catalog';
import { requireValidKioskDeviceSession } from '@/lib/kiosk/device-session';
import { loadKioskHomeContext } from '@/lib/kiosk/home-context';

export const dynamic = 'force-dynamic';

export default async function KioskCatalogPage() {
  const session = await requireValidKioskDeviceSession();
  if (!session.ok) {
    redirect(session.reason === 'commercially_blocked' ? '/k' : '/k/pair');
  }

  // Home y catálogo son independientes tras validar sesión (menos latencia en serie).
  const [home, initial] = await Promise.all([
    loadKioskHomeContext(session.session),
    searchKioskCatalog({ query: '', limit: 40 }),
  ]);
  const initialItems = initial.ok ? initial.items : [];

  return (
    <KioskCartProvider pharmacyId={session.session.pharmacyId}>
      <KioskCatalogView
        pharmacyName={home.pharmacyName || session.session.displayName}
        initialItems={initialItems}
      />
    </KioskCartProvider>
  );
}
