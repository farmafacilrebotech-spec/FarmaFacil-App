'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Cierra la sesión actual y redirige al login de la cuenta destinataria.
 * No genera magic links a partir del email de la URL (evitar secuestro de sesión).
 */
export async function continueAsInviteRecipientAction(
  recipientEmail: string
): Promise<void> {
  const email = recipientEmail.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect('/login?hint=invite');
  }

  const supabase = createClient();
  await supabase.auth.signOut();

  const params = new URLSearchParams({
    next: '/auth/invitations',
    email,
    hint: 'invite',
  });
  redirect(`/login?${params.toString()}`);
}

/** Form action para el botón «Continuar con {email}» en /auth/invitations. */
export async function continueAsInviteRecipientFormAction(
  formData: FormData
): Promise<void> {
  const email = String(formData.get('email') ?? '');
  await continueAsInviteRecipientAction(email);
}
