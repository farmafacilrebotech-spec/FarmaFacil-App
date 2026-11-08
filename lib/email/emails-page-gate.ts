import { redirect } from 'next/navigation';

import { requireEmailsAccess } from '@/lib/email/require-emails-access';

/** Gate de página: solo SuperAdmin. Support → access-denied. */
export async function assertEmailsPageAccess(): Promise<void> {
  const access = await requireEmailsAccess('read');
  if (access.ok) return;
  if (access.reason === 'unauthenticated') {
    redirect('/login');
  }
  redirect('/access-denied');
}
