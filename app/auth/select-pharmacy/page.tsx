import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';

import {
  destinationForAppAccess,
  listActiveMemberships,
  resolveAppAccess,
  type PharmacyMembershipSummary,
} from '@/lib/auth/access';
import { listAuthorizedPharmaciesForProfile } from '@/lib/pharmacies/tenant';
import { pharmacyRoleLabel } from '@/lib/pharmacies/role-labels';
import { isHighlightedLastPharmacy } from '@/lib/pharmacies/pharmacy-access-routing';
import type { PendingPharmacyInvitation } from '@/lib/pharmacies/invitations';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { PendingInvitationsList } from '@/components/auth/pending-invitations-list';
import { signOutAction } from '@/app/auth/actions';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Selector multi-farmacia: solo memberships active (cualquier rol).
 * Tras login con ≥2 farmacias siempre se muestra aquí (last_pharmacy no salta).
 * Al elegir una opción se va directo a /f/:id/dashboard.
 */
export default async function SelectPharmacyPage() {
  const access = await resolveAppAccess();

  if (access.status === 'unauthenticated') {
    redirect('/login');
  }
  if (access.status === 'invited') {
    redirect(destinationForAppAccess(access));
  }
  if (access.status === 'pharmacy') {
    redirect(`/f/${access.membership.pharmacyId}/dashboard`);
  }

  let memberships: PharmacyMembershipSummary[] = [];
  let profileId: string | null = null;
  let lastPharmacyId: string | null = null;
  let pendingInvitations: PendingPharmacyInvitation[] = [];

  if (access.status === 'multiple_pharmacies') {
    memberships = access.memberships;
    profileId = access.profile.id;
    lastPharmacyId = access.profile.lastPharmacyId;
    pendingInvitations = access.pendingInvitations;
  } else if (access.status === 'platform') {
    const listed = await listActiveMemberships(access.profile.id);
    memberships = listed.memberships;
    profileId = access.profile.id;
    lastPharmacyId = access.profile.lastPharmacyId;
    if (memberships.length === 0) {
      redirect('/dashboard');
    }
    if (memberships.length === 1) {
      redirect(`/f/${memberships[0].pharmacyId}/dashboard`);
    }
  } else {
    redirect('/access-denied');
  }

  if (memberships.length < 2 || !profileId) {
    redirect('/access-denied');
  }

  const pharmacies = await listAuthorizedPharmaciesForProfile(profileId);
  const byId = new Map(pharmacies.map((p) => [p.id, p]));
  const activeIds = memberships.map((m) => m.pharmacyId);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <BrandLogo size={96} showTagline />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-soft-lg">
        <h1 className="text-xl font-semibold text-foreground">
          Varias farmacias
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta tiene acceso a más de una farmacia. Elige a cuál entrar.
          El rol y los permisos dependen de la farmacia seleccionada.
        </p>
        <ul className="mt-6 space-y-2">
          {memberships.map((m) => {
            const pharmacy = byId.get(m.pharmacyId);
            const label = pharmacy?.name ?? 'Farmacia';
            const location = [pharmacy?.city, pharmacy?.province]
              .filter(Boolean)
              .join(', ');
            const roleLabel = pharmacyRoleLabel(m.roleKey);
            const highlighted = isHighlightedLastPharmacy({
              pharmacyId: m.pharmacyId,
              lastPharmacyId,
              activePharmacyIds: activeIds,
            });
            return (
              <li key={m.membershipId}>
                <Button
                  asChild
                  variant="outline"
                  className={cn(
                    'h-auto w-full justify-start py-3',
                    highlighted && 'border-primary/40 bg-primary/5'
                  )}
                >
                  <Link href={`/f/${m.pharmacyId}/dashboard`}>
                    <span className="flex min-w-0 flex-1 items-start justify-between gap-2 text-left">
                      <span className="flex min-w-0 flex-col items-start">
                        <span className="truncate font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">
                          {roleLabel}
                          {location ? ` · ${location}` : ''}
                          {highlighted ? ' · Última utilizada' : ''}
                        </span>
                      </span>
                      {highlighted ? (
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                          aria-hidden
                        />
                      ) : null}
                    </span>
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
        {pendingInvitations.length > 0 ? (
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="text-sm font-medium text-foreground">
              Invitaciones pendientes
            </h2>
            <PendingInvitationsList invitations={pendingInvitations} />
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
