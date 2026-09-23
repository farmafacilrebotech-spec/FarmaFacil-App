'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import type { PharmacyMember, PharmacyRoleOption, PharmacyRoleKey } from '@/lib/pharmacies/types';
import { editPharmacyUserAction } from '@/app/(app)/farmacias/membership-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function EditPharmacyUserDialog({
  open,
  onOpenChange,
  pharmacyId,
  member,
  roles,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacyId: string;
  member: PharmacyMember;
  roles: PharmacyRoleOption[];
  onSuccess: (message: string, meta?: { suggestResendInvitation: boolean }) => void;
}) {
  const [fullName, setFullName] = React.useState(member.profile.full_name ?? '');
  const [email, setEmail] = React.useState(member.profile.email);
  const [roleKey, setRoleKey] = React.useState<string>(member.role.key);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setFullName(member.profile.full_name ?? '');
      setEmail(member.profile.email);
      setRoleKey(member.role.key);
      setError(null);
      setSubmitting(false);
    }
  }, [open, member]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const result = await editPharmacyUserAction({
        pharmacyId,
        membershipId: member.id,
        fullName,
        email,
        roleKey,
      });

      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      onSuccess(result.message, {
        suggestResendInvitation: result.suggestResendInvitation,
      });
      onOpenChange(false);
    } catch {
      setError('No se ha podido guardar. Inténtalo de nuevo.');
      setSubmitting(false);
    }
  }

  const canSubmit =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    roleKey.length > 0 &&
    !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>
            Corrige nombre, email o rol de esta farmacia. El email de acceso se
            actualiza en Auth sin crear un usuario nuevo ni afectar otras
            farmacias.
            {member.status === 'invited'
              ? ' Si cambias el email, reenvía la invitación después.'
              : null}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-user-name">Nombre completo</Label>
            <Input
              id="edit-user-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-user-email">Email</Label>
            <Input
              id="edit-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-user-role">Rol en esta farmacia</Label>
            <Select
              value={roleKey}
              onValueChange={(v) => setRoleKey(v as PharmacyRoleKey)}
            >
              <SelectTrigger id="edit-user-role">
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.key}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                'Guardar cambios'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
