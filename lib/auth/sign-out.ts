'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { clearKioskSessionCookie } from '@/lib/kiosk/session-cookie';

/** Borra cookies de Auth SSR (sesión + PKCE) para que el middleware no reautentique. */
export async function clearSupabaseAuthCookies() {
  const cookieStore = cookies();
  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name.startsWith('sb-') ||
      cookie.name.includes('auth-token') ||
      cookie.name.includes('code-verifier')
    ) {
      try {
        cookieStore.set({
          name: cookie.name,
          value: '',
          path: '/',
          maxAge: 0,
        });
      } catch {
        // Algunos contextos de render no permiten set.
      }
    }
  }
}

/**
 * Cierra sesión Auth de forma fiable (revoke + cookies SSR).
 * Debe invocarse SOLO desde server action / form action — no mezclar
 * con signOut del browser client antes, o las cookies quedan en carrera.
 *
 * También borra la cookie HttpOnly de sesión de dispositivo kiosko
 * (`ff_kiosk_device_session`, path `/k`) en este navegador.
 *
 * NO toca:
 * - Vinculación persistente del dispositivo en BD (pairing / device row).
 * - Entitlement comercial del módulo kiosko.
 * - Revocación remota de dispositivos.
 */
export async function signOutAndClearCookies(): Promise<{ ok: boolean }> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) {
    console.error('[auth] signOut', error.message);
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
  await clearSupabaseAuthCookies();
  clearKioskSessionCookie();
  return { ok: !error };
}
