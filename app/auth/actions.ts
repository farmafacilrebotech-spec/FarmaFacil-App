'use server';

import { redirect } from 'next/navigation';
import { signOutAndClearCookies } from '@/lib/auth/sign-out';

/**
 * Única acción de logout de FarmaFácil (SuperAdmin y farmacia).
 * Revoca sesión, limpia cookies SSR y redirige a /login.
 * No basta con router.push('/login').
 */
export async function signOutAction() {
  await signOutAndClearCookies();
  redirect('/login');
}
