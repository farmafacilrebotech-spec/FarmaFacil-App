import { redirect } from 'next/navigation';
import Link from 'next/link';

import {
  destinationForAppAccess,
  resolveAppAccess,
} from '@/lib/auth/access';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { PendingInvitationsList } from '@/components/auth/pending-invitations-list';
import { signOutAction } from '@/app/auth/actions';

export const dynamic = 'force-dynamic';

/**
 * Invitaciones pending para usuarios FarmaFácil ya establecidos
 * (legal vigente aceptado). No sustituye /first-access.
 */
export default async function AuthInvitationsPage() {
  const access = await resolveAppAccess();

  if (access.status === 'unauthenticated') {
    redirect('/login?next=/auth/invitations');
  }

  if (access.status === 'invited' && access.needsFirstAccess) {
    redirect('/first-access');
  }

  const pending =
    access.status === 'invited' ||
    access.status === 'pharmacy' ||
    access.status === 'multiple_pharmacies'
      ? access.pendingInvitations
      : [];

  if (pending.length === 0) {
    redirect(destinationForAppAccess(access));
  }

  const canContinueElsewhere =
    access.status === 'pharmacy' || access.status === 'multiple_pharmacies';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <BrandLogo size={44} showTagline />
      <div className="mt-8 w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
        <h1 className="text-xl font-semibold text-foreground">
          Invitaciones pendientes
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Te han invitado a acceder a una o más farmacias. Acepta cada
          invitación para activar el acceso. No necesitas crear una contraseña
          nueva.
        </p>

        <PendingInvitationsList invitations={pending} />

        <div className="mt-6 flex flex-col gap-2">
          {canContinueElsewhere ? (
            <Button asChild variant="outline" className="w-full">
              <Link href={destinationForAppAccess(access)}>
                Continuar sin aceptar ahora
              </Link>
            </Button>
          ) : null}
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" className="w-full">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
