'use client';

import * as React from 'react';
import { Plus, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';

import type { PharmacyMember, PharmacyRoleOption } from '@/lib/pharmacies/types';
import { MEMBERSHIP_STATUS_LABELS } from '@/lib/pharmacies/labels';
import { formatDateTime, initials } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  StatusBadge,
  toneForUserStatus,
} from '@/components/shared/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InviteUserDialog } from '@/components/pharmacies/invite-user-dialog';

export function PharmacyUsersPanel({
  pharmacyId,
  members: initialMembers,
  roles,
  onSuccessMessage,
}: {
  pharmacyId: string;
  members: PharmacyMember[];
  roles: PharmacyRoleOption[];
  onSuccessMessage: (message: string) => void;
}) {
  const router = useRouter();
  const [members, setMembers] = React.useState(initialMembers);
  const [inviteOpen, setInviteOpen] = React.useState(false);

  React.useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  const invitedCount = members.filter((m) => m.status === 'invited').length;
  const activeCount = members.filter((m) => m.status === 'active').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Usuarios con acceso
          </h3>
          <p className="text-sm text-muted-foreground">
            {members.length === 0
              ? 'Todavía no hay usuarios en esta farmacia.'
              : `${members.length} usuario${members.length === 1 ? '' : 's'} · ${activeCount} activo${activeCount === 1 ? '' : 's'} · ${invitedCount} invitado${invitedCount === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setInviteOpen(true)}
        >
          <Plus className="h-4 w-4" /> Invitar usuario
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        {members.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Mail className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 text-sm font-medium text-foreground">
              Sin usuarios todavía
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Invita al propietario o administrador de esta farmacia.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Usuario
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Rol
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Estado
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">
                    Invitación
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const displayName =
                    m.profile.full_name?.trim() || m.profile.email;
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 border border-border">
                            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                              {initials(displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">
                            {displayName}
                          </span>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3.5 text-muted-foreground md:table-cell">
                        {m.profile.email}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                          {m.role.name}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge tone={toneForUserStatus(m.status)}>
                          {MEMBERSHIP_STATUS_LABELS[m.status] ?? m.status}
                        </StatusBadge>
                      </td>
                      <td className="hidden px-4 py-3.5 text-muted-foreground lg:table-cell">
                        {m.invited_at ? formatDateTime(m.invited_at) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        pharmacyId={pharmacyId}
        roles={roles}
        onSuccess={(message) => {
          onSuccessMessage(message);
          router.refresh();
        }}
      />
    </div>
  );
}
