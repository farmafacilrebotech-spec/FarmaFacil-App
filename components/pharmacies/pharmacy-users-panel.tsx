'use client';

import * as React from 'react';
import {
  Plus,
  Mail,
  MoreHorizontal,
  Ban,
  RotateCcw,
  UserX,
  Send,
  Pencil,
  KeyRound,
  UserPlus,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import type { PharmacyMember, PharmacyRoleOption } from '@/lib/pharmacies/types';
import { MEMBERSHIP_STATUS_LABELS } from '@/lib/pharmacies/labels';
import { formatDateTime, initials } from '@/lib/format';
import {
  cancelPharmacyInvitationAction,
  reactivatePharmacyMembershipAction,
  reinvitePharmacyMembershipAction,
  resendPharmacyInvitationAction,
  revokePharmacyMembershipAction,
  sendPasswordResetForMembershipAction,
  suspendPharmacyMembershipAction,
} from '@/app/(app)/farmacias/membership-actions';
import { Button } from '@/components/ui/button';
import {
  StatusBadge,
  toneForUserStatus,
} from '@/components/shared/status-badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { InviteUserDialog } from '@/components/pharmacies/invite-user-dialog';
import { EditPharmacyUserDialog } from '@/components/pharmacies/edit-pharmacy-user-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ConfirmAction =
  | 'suspend'
  | 'reactivate'
  | 'revoke'
  | 'cancel_invitation'
  | 'reinvite'
  | 'send_password_reset';

const CONFIRM_COPY: Record<
  ConfirmAction,
  {
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
  }
> = {
  suspend: {
    title: '¿Suspender acceso?',
    description:
      'El usuario perderá de inmediato el acceso a esta farmacia. Podrás reactivarlo más adelante.',
    confirmLabel: 'Suspender acceso',
    destructive: true,
  },
  reactivate: {
    title: '¿Reactivar acceso?',
    description:
      'El usuario recuperará el acceso a esta farmacia de inmediato.',
    confirmLabel: 'Reactivar acceso',
  },
  revoke: {
    title: '¿Revocar acceso?',
    description:
      'El usuario dejará de pertenecer a esta farmacia. No se borrará su cuenta. Podrás volver a invitarlo más adelante.',
    confirmLabel: 'Revocar acceso',
    destructive: true,
  },
  cancel_invitation: {
    title: '¿Cancelar invitación?',
    description:
      'La invitación dejará de ser válida para completar el acceso a esta farmacia.',
    confirmLabel: 'Cancelar invitación',
    destructive: true,
  },
  reinvite: {
    title: '¿Volver a invitar?',
    description:
      'Se creará de nuevo una invitación pendiente para esta farmacia (misma cuenta). El usuario deberá aceptarla; no se reactivará el acceso automáticamente.',
    confirmLabel: 'Volver a invitar',
  },
  send_password_reset: {
    title: '¿Enviar acceso / Restablecer contraseña?',
    description:
      'Se enviará un enlace de recuperación al email actual del usuario. No se modifica su estado ni su membresía en esta farmacia.',
    confirmLabel: 'Enviar enlace',
  },
};

/**
 * Menú de acciones por fila: estado y membershipId solo de `member` de esta celda.
 * No comparte estado con otras filas.
 */
function MemberActionsCell({
  pharmacyId,
  member,
  roles,
  onDone,
}: {
  pharmacyId: string;
  member: PharmacyMember;
  roles: PharmacyRoleOption[];
  onDone: (message: string) => void;
}) {
  // Estado local por instancia de fila (key = membership id en el padre).
  const membershipId = member.id;
  const status = member.status;

  const [confirm, setConfirm] = React.useState<ConfirmAction | null>(null);
  const [pending, setPending] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  function openConfirm(action: ConfirmAction) {
    // Evita la carrera Radix Dropdown→AlertDialog que cerraba el confirm.
    window.setTimeout(() => setConfirm(action), 0);
  }

  async function runConfirmed() {
    if (!confirm || pending) return;
    setPending(true);

    const input = { pharmacyId, membershipId };
    let result;
    switch (confirm) {
      case 'suspend':
        result = await suspendPharmacyMembershipAction(input);
        break;
      case 'reactivate':
        result = await reactivatePharmacyMembershipAction(input);
        break;
      case 'revoke':
        result = await revokePharmacyMembershipAction(input);
        break;
      case 'cancel_invitation':
        result = await cancelPharmacyInvitationAction(input);
        break;
      case 'reinvite':
        result = await reinvitePharmacyMembershipAction(input);
        break;
      case 'send_password_reset':
        result = await sendPasswordResetForMembershipAction(input);
        break;
    }

    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setConfirm(null);
    onDone(result.message);
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    const result = await resendPharmacyInvitationAction({
      pharmacyId,
      membershipId,
    });
    setResending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onDone(result.message);
  }

  const copy = confirm ? CONFIRM_COPY[confirm] : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label="Acciones"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar usuario
          </DropdownMenuItem>
          <DropdownMenuSeparator />

          {status === 'invited' ? (
            <>
              <DropdownMenuItem
                disabled={resending}
                onSelect={(e) => {
                  e.preventDefault();
                  void handleResend();
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                {resending ? 'Reenviando…' : 'Reenviar invitación'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  openConfirm('cancel_invitation');
                }}
              >
                <Ban className="mr-2 h-4 w-4" />
                Cancelar invitación
              </DropdownMenuItem>
            </>
          ) : null}

          {status === 'active' ? (
            <>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  openConfirm('send_password_reset');
                }}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Enviar acceso / Restablecer contraseña
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  openConfirm('suspend');
                }}
              >
                <Ban className="mr-2 h-4 w-4" />
                Suspender acceso
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  openConfirm('revoke');
                }}
              >
                <UserX className="mr-2 h-4 w-4" />
                Revocar acceso
              </DropdownMenuItem>
            </>
          ) : null}

          {status === 'suspended' ? (
            <>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  openConfirm('send_password_reset');
                }}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Enviar acceso / Restablecer contraseña
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  openConfirm('reactivate');
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reactivar acceso
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  openConfirm('revoke');
                }}
              >
                <UserX className="mr-2 h-4 w-4" />
                Revocar acceso
              </DropdownMenuItem>
            </>
          ) : null}

          {status === 'revoked' ? (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                openConfirm('reinvite');
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Volver a invitar
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirm != null}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className={
                copy?.destructive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
              onClick={(e) => {
                e.preventDefault();
                void runConfirmed();
              }}
            >
              {pending ? 'Aplicando…' : copy?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditPharmacyUserDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        pharmacyId={pharmacyId}
        member={member}
        roles={roles}
        onSuccess={(message, meta) => {
          onDone(message);
          if (meta?.suggestResendInvitation) {
            toast.message('Reenvía la invitación al email corregido.', {
              description: 'Usa «Reenviar invitación» en Acciones.',
            });
          }
        }}
      />
    </>
  );
}

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

  function handleActionDone(message: string) {
    onSuccessMessage(message);
    toast.success(message);
    router.refresh();
  }

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
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Acciones
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
                      <td className="px-4 py-3.5 text-right">
                        <MemberActionsCell
                          key={m.id}
                          pharmacyId={pharmacyId}
                          member={m}
                          roles={roles}
                          onDone={handleActionDone}
                        />
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
