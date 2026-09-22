'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import type { PharmacyRoleOption, PharmacyRoleKey } from '@/lib/pharmacies/types';
import { invitePharmacyUserAction } from '@/app/(app)/farmacias/invite-actions';
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

export function InviteUserDialog({
  open,
  onOpenChange,
  pharmacyId,
  roles,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacyId: string;
  roles: PharmacyRoleOption[];
  onSuccess: (message: string) => void;
}) {
  const defaultRole =
    roles.find((r) => r.key === 'PHARMACY_OWNER')?.key ?? roles[0]?.key ?? '';

  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [roleKey, setRoleKey] = React.useState<string>(defaultRole);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setFullName('');
      setEmail('');
      setRoleKey(defaultRole);
      setError(null);
      setSubmitting(false);
    }
  }, [open, defaultRole]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const result = await invitePharmacyUserAction({
        pharmacyId,
        fullName,
        email,
        roleKey,
      });

      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      const message = result.invitationEmailSent
        ? 'Invitación enviada. El usuario aparece como Invitado.'
        : 'Acceso registrado. El usuario aparece como Invitado.';

      onSuccess(message);
      onOpenChange(false);
    } catch {
      setError('No se ha podido completar la invitación. Inténtalo de nuevo.');
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
          <DialogTitle>Invitar usuario</DialogTitle>
          <DialogDescription>
            Se enviará un email de invitación (si el usuario es nuevo) y se
            creará el acceso a esta farmacia con estado Invitado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-name">Nombre</Label>
            <Input
              id="invite-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nombre y apellidos"
              autoComplete="name"
              disabled={submitting}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@farmacia.es"
              autoComplete="email"
              disabled={submitting}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Rol</Label>
            <Select
              value={roleKey}
              onValueChange={(v) => setRoleKey(v as PharmacyRoleKey)}
              disabled={submitting || roles.length === 0}
            >
              <SelectTrigger id="invite-role">
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.key}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar invitación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
