'use server';

import { redirect } from 'next/navigation';

import { signOutAndClearCookies } from '@/lib/auth/sign-out';
import { normalizePublicEntrypointId } from '@/lib/kiosk/public-id';

/**
 * Cierre de sesión del área cliente.
 * No borra farmacias guardadas, pedidos ni perfil.
 * Redirige al catálogo (si hay publicId) o al login de cliente.
 */
export async function customerSignOutAction(formData: FormData) {
  const raw = String(formData.get('publicId') ?? '');
  const publicId = normalizePublicEntrypointId(raw);
  await signOutAndClearCookies();
  if (publicId) {
    redirect(`/e/${publicId}/catalogo`);
  }
  redirect('/cuenta/entrar');
}
