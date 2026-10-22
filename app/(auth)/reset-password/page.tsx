import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { ResetPasswordForm } from '@/app/(auth)/reset-password/reset-password-form';

export const dynamic = 'force-dynamic';

/**
 * Establecer nueva contraseña tras recovery.
 * Exige sesión Auth válida (creada por /auth/recovery). Sin sesión → solicitud.
 */
export default async function ResetPasswordPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/forgot-password?error=recovery_invalid');
  }

  return <ResetPasswordForm />;
}
