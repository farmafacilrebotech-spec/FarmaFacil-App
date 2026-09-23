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
import { continueAsInviteRecipientFormAction } from '@/app/auth/invitations/continue-actions';

export const dynamic = 'force-dynamic';

function normalizeEmail(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Invitaciones pending para usuarios FarmaFácil ya establecidos.
 * Si ?for=email no coincide con la sesión, bloquea la aceptación
 * (?for= solo UX; la auth real es Auth + RPC 024).
 */
export default async function AuthInvitationsPage({
  searchParams,
}: {
  searchParams?: { for?: string };
}) {
  const access = await resolveAppAccess();

  if (access.status === 'unauthenticated') {
    const forEmail = normalizeEmail(searchParams?.for);
    const params = new URLSearchParams({ next: '/auth/invitations' });
    if (forEmail) {
      params.set('email', forEmail);
      params.set('hint', 'invite');
    }
    redirect(`/login?${params.toString()}`);
  }

  if (access.status === 'invited' && access.needsFirstAccess) {
    redirect('/first-access');
  }

  const sessionEmail =
    access.status === 'invited' ||
    access.status === 'pharmacy' ||
    access.status === 'multiple_pharmacies' ||
    access.status === 'platform' ||
    access.status === 'forbidden'
      ? normalizeEmail(access.profile.email)
      : '';

  const intendedEmail = normalizeEmail(searchParams?.for);
  const sessionMismatch =
    Boolean(intendedEmail) &&
    Boolean(sessionEmail) &&
    intendedEmail !== sessionEmail;

  if (sessionMismatch) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <BrandLogo size={44} showTagline />
        <div className="mt-8 w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
          <h1 className="text-xl font-semibold text-foreground">
            Cuenta incorrecta
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Esta invitación corresponde a{' '}
            <span className="font-medium text-foreground">{intendedEmail}</span>.
            Actualmente has iniciado sesión con otra cuenta
            {sessionEmail ? (
              <>
                {' '}
                (
                <span className="font-medium text-foreground">
                  {sessionEmail}
                </span>
                )
              </>
            ) : null}
            .
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            No puedes aceptar esta invitación con la sesión actual. Continúa
            con la cuenta destinataria.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <form action={continueAsInviteRecipientFormAction}>
              <input type="hidden" name="email" value={intendedEmail} />
              <Button type="submit" className="w-full">
                Continuar con {intendedEmail}
              </Button>
            </form>
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
