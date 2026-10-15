import { redirect } from 'next/navigation';
import Link from 'next/link';

import {
  destinationForAppAccess,
  resolveAppAccess,
} from '@/lib/auth/access';
import { listAuthorizedPharmaciesForProfile } from '@/lib/pharmacies/tenant';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { PendingInvitationsList } from '@/components/auth/pending-invitations-list';
import { signOutAction } from '@/app/auth/actions';

export const dynamic = 'force-dynamic';

/**
 * Estado explícito multi-farmacia (V1).
 * Lista solo memberships active del usuario (con nombre real).
 */
export default async function SelectPharmacyPage() {
  const access = await resolveAppAccess();

  if (access.status === 'unauthenticated') {
    redirect('/login');
  }
  if (access.status === 'platform') {
    redirect('/dashboard');
  }
  if (access.status === 'pharmacy') {
    redirect(`/f/${access.membership.pharmacyId}/dashboard`);
  }
  if (access.status === 'invited') {
    redirect(destinationForAppAccess(access));
  }
  if (access.status !== 'multiple_pharmacies') {
    redirect('/access-denied');
  }

  const pharmacies = await listAuthorizedPharmaciesForProfile(
    access.profile.id
  );
  const byId = new Map(pharmacies.map((p) => [p.id, p]));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <BrandLogo size={96} showTagline />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
        <h1 className="text-xl font-semibold text-foreground">
          Varias farmacias
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta tiene acceso a más de una farmacia. Elige a cuál entrar.
        </p>
        <ul className="mt-6 space-y-2">
          {access.memberships.map((m) => {
            const pharmacy = byId.get(m.pharmacyId);
            const label = pharmacy?.name ?? 'Farmacia';
            const location = [pharmacy?.city, pharmacy?.province]
              .filter(Boolean)
              .join(', ');
            return (
              <li key={m.membershipId}>
                <Button
                  asChild
                  variant="outline"
                  className="h-auto w-full justify-start py-3"
                >
                  <Link href={`/f/${m.pharmacyId}/dashboard`}>
                    <span className="flex min-w-0 flex-col items-start text-left">
                      <span className="truncate font-medium">{label}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.roleName}
                        {location ? ` · ${location}` : ''}
                      </span>
                    </span>
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
        {access.pendingInvitations.length > 0 ? (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="text-sm font-medium text-foreground">
              Invitaciones pendientes
            </h2>
            <PendingInvitationsList invitations={access.pendingInvitations} />
          </div>
        ) : null}
        <form action={signOutAction} className="mt-6">
          <Button type="submit" variant="ghost" className="w-full">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </div>
  );
}
