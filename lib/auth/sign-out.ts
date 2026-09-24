'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

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
 * Usar desde signOutAction y tras reset de contraseña.
 */
export async function signOutAndClearCookies(): Promise<{ ok: boolean }> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) {
    console.error('[auth] signOut', error.message);
    // Intento local si el revoke global falla (red / token ya inválido).
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
  await clearSupabaseAuthCookies();
  return { ok: !error };
}
