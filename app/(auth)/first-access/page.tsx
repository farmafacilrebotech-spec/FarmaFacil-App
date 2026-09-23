import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import {
  destinationForAppAccess,
  resolveAppAccess,
} from '@/lib/auth/access';
import {
  FirstAccessForm,
  FirstAccessNoSession,
} from '@/components/auth/first-access-form';

export const dynamic = 'force-dynamic';

/**
 * Primer acceso del usuario invitado.
 * Requiere sesión (establecida vía /auth/callback).
 * No pide email; no usa metadata para autorizar.
 */
export default async function FirstAccessPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <FirstAccessNoSession />;
  }

  const access = await resolveAppAccess();
  if (access.status !== 'invited' && access.status !== 'unauthenticated') {
    redirect(destinationForAppAccess(access));
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  const displayName = profile?.full_name?.trim() || null;
  const email = profile?.email || user.email || '';

  return <FirstAccessForm displayName={displayName} email={email} />;
}
