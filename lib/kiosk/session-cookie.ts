import { cookies } from 'next/headers';
import {
  encodeKioskSessionCookie,
  parseKioskSessionCookie,
} from '@/lib/kiosk/session-cookie-parse';
import { KIOSK_SESSION_COOKIE_PATH } from '@/lib/kiosk/session-cookie-path';

export { encodeKioskSessionCookie, parseKioskSessionCookie };
export { KIOSK_SESSION_COOKIE_PATH };

/** Cookie HttpOnly de sesión de dispositivo kiosko (solo rutas /k). */
export const KIOSK_SESSION_COOKIE = 'ff_kiosk_device_session';

export function setKioskSessionCookie(
  sessionId: string,
  credential: string
): void {
  const store = cookies();
  store.set({
    name: KIOSK_SESSION_COOKIE,
    value: encodeKioskSessionCookie(sessionId, credential),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: KIOSK_SESSION_COOKIE_PATH,
    maxAge: 90 * 24 * 60 * 60,
  });
}

export function clearKioskSessionCookie(): void {
  const store = cookies();
  store.set({
    name: KIOSK_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: KIOSK_SESSION_COOKIE_PATH,
    maxAge: 0,
  });
}

export function readKioskSessionCookie(): string | undefined {
  return cookies().get(KIOSK_SESSION_COOKIE)?.value;
}
