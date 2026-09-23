'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import type { PendingPharmacyInvitation } from '@/lib/pharmacies/invitations';
import { acceptPharmacyInvitationAction } from '@/app/auth/invitations/actions';
import { Button } from '@/components/ui/button';

export function PendingInvitationsList({
  invitations,
}: {
  invitations: PendingPharmacyInvitation[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleAccept(membershipId: string) {
    if (busyId) return;
    setError(null);
    setBusyId(membershipId);

    try {
      const result = await acceptPharmacyInvitationAction(membershipId);
      if (!result.ok) {
        setError(result.error);
        setBusyId(null);
        return;
      }
      router.replace(result.redirectTo);
      router.refresh();
    } catch {
      setError('No se ha podido aceptar la invitación. Inténtalo de nuevo.');
      setBusyId(null);
    }
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 space-y-3">
      <p className="text-sm text-muted-foreground">
        Tienes{' '}
        {invitations.length === 1
          ? 'una invitación pendiente'
          : `${invitations.length} invitaciones pendientes`}
        . Acéptala para activar el acceso a esa farmacia.
      </p>

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ul className="space-y-2">
        {invitations.map((inv) => {
          const busy = busyId === inv.membershipId;
          return (
            <li
              key={inv.membershipId}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">{inv.pharmacyName}</p>
                <p className="text-sm text-muted-foreground">
                  Rol: {inv.roleName}
                </p>
              </div>
              <Button
                type="button"
                onClick={() => handleAccept(inv.membershipId)}
                disabled={busyId != null}
                className="shrink-0"
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aceptando…
                  </>
                ) : (
                  'Aceptar invitación'
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
