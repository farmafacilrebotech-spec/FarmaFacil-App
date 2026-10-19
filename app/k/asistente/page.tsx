import { redirect } from 'next/navigation';

import { requireValidKioskDeviceSession } from '@/lib/kiosk/device-session';
import { KioskComingSoon } from '@/components/kiosk/kiosk-coming-soon';

export const dynamic = 'force-dynamic';

export default async function KioskAssistantPage() {
  const session = await requireValidKioskDeviceSession();
  if (!session.ok) {
    redirect(session.reason === 'commercially_blocked' ? '/k' : '/k/pair');
  }

  return (
    <KioskComingSoon
      title="Asistente IA"
      description="El asistente de consulta farmacéutica aún no está habilitado en el kiosko. Cuando esté activo, solo responderá en el contexto de esta farmacia."
    />
  );
}
