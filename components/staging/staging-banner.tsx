import { headers } from 'next/headers';

import { isStagingAppEnv } from '@/lib/env/staging-runtime-guard';

/**
 * Cinta visible solo en despliegues FF_APP_ENV=staging.
 * No es un control de seguridad: solo evita confusión con producción.
 *
 * En el APK del kiosko (User-Agent con `FarmaFacilKiosk`) ya existe un banner
 * nativo; se oculta el banner web para no duplicarlo.
 */
export function StagingBanner() {
  if (!isStagingAppEnv()) return null;

  let userAgent = '';
  try {
    userAgent = headers().get('user-agent') ?? '';
  } catch {
    userAgent = '';
  }
  if (/FarmaFacilKiosk/i.test(userAgent)) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] border-b border-amber-700/40 bg-amber-500 px-3 py-1.5 text-center text-xs font-semibold tracking-wide text-amber-950"
    >
      STAGING · FarmaFácil de pruebas · datos ficticios · sin cobros ni envíos
      reales
    </div>
  );
}
