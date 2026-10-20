import { redirect } from 'next/navigation';

import { KioskAssistantDisabled } from '@/components/kiosk/kiosk-assistant-disabled';
import { KioskAssistantView } from '@/components/kiosk/kiosk-assistant-view';
import { KioskCartProvider } from '@/components/kiosk/kiosk-cart-provider';
import {
  DEMO_ASSISTANT_NAME,
  DEMO_WELCOME_MESSAGE,
} from '@/lib/kiosk/assistant/demo-content';
import { loadAssistantRuntimeStatus } from '@/lib/kiosk/assistant/runtime';
import { requireValidKioskDeviceSession } from '@/lib/kiosk/device-session';
import { loadKioskHomeContext } from '@/lib/kiosk/home-context';

export const dynamic = 'force-dynamic';

export default async function KioskAssistantPage() {
  const session = await requireValidKioskDeviceSession();
  if (!session.ok) {
    redirect(session.reason === 'commercially_blocked' ? '/k' : '/k/pair');
  }

  const home = await loadKioskHomeContext(session.session);
  const pharmacyName =
    home.pharmacyName || session.session.displayName || 'Tu farmacia';

  const runtime = await loadAssistantRuntimeStatus();
  if (!runtime.ok) {
    if (runtime.code === 'module_disabled') {
      return (
        <KioskAssistantDisabled
          pharmacyName={pharmacyName}
          reason="module_disabled"
        />
      );
    }
    if (runtime.code === 'limit_exceeded') {
      return (
        <KioskAssistantDisabled
          pharmacyName={pharmacyName}
          reason="limit_exceeded"
        />
      );
    }
    if (
      runtime.code === 'session_invalid' ||
      runtime.code === 'commercially_blocked'
    ) {
      redirect(
        runtime.code === 'commercially_blocked' ? '/k' : '/k/pair'
      );
    }
    return (
      <KioskAssistantDisabled pharmacyName={pharmacyName} reason="error" />
    );
  }

  const { context } = runtime;
  const assistantName =
    context.mode === 'demo'
      ? DEMO_ASSISTANT_NAME
      : context.settings.assistantName || 'Asistente FarmaFácil';

  const welcomeText =
    context.mode === 'demo'
      ? DEMO_WELCOME_MESSAGE
      : context.settings.welcomeMessage.trim() ||
        `Hola, soy ${assistantName}. Puedo orientarte sobre consultas habituales y categorías de parafarmacia. No sustituyo al farmacéutico: si tu duda es clínica o personalizada, pídele ayuda en el mostrador.`;

  return (
    <KioskCartProvider pharmacyId={session.session.pharmacyId}>
      <KioskAssistantView
        pharmacyName={pharmacyName}
        assistantName={assistantName}
        welcomeText={welcomeText}
        mode={context.mode}
        pharmacistConsultEnabled={context.pharmacistConsultEnabled}
        sessionBinding={{
          pharmacyId: session.session.pharmacyId,
          deviceId: session.session.deviceId,
          sessionId: session.session.sessionId,
        }}
      />
    </KioskCartProvider>
  );
}
