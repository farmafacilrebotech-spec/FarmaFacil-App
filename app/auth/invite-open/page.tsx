import { Suspense } from 'react';

import { InviteOpenClient } from '@/components/auth/invite-open-client';

export const dynamic = 'force-dynamic';

/**
 * Landing del email de invitación.
 * No llama a verifyOtp en el GET (evita que un prefetch consuma el OTP).
 */
export default function InviteOpenPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-muted-foreground">
          Cargando invitación…
        </div>
      }
    >
      <InviteOpenClient />
    </Suspense>
  );
}
