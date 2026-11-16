'use server';

import { redirect } from 'next/navigation';

import { signOutAndClearCookies } from '@/lib/auth/sign-out';

/** Cierre de sesión desde rutas globales `/cuenta`. */
export async function globalCustomerSignOutAction() {
  await signOutAndClearCookies();
  redirect('/cuenta/entrar');
}
