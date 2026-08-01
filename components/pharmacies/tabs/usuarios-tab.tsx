'use client';

import * as React from 'react';
import { Plus, MoreHorizontal, Mail, Clock } from 'lucide-react';
import type { Pharmacy } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import { userRoleLabels, userStatusLabels } from '@/lib/mock-data';
import { Button } from '@/components/ui/button';
import {
  StatusBadge,
  toneForUserStatus,
} from '@/components/shared/status-badge';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import { initials } from '@/lib/format';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function UsuariosTab({ pharmacy }: { pharmacy: Pharmacy }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Usuarios con acceso
          </h3>
          <p className="text-sm text-muted-foreground">
            {pharmacy.users.length} usuarios · 1 administrador ·{' '}
            {pharmacy.users.length - 1} empleados
          </p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo usuario
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
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
                  Último acceso
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {pharmacy.users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border border-border">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                          {initials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">
                        {u.name}
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3.5 text-muted-foreground md:table-cell">
                    {u.email}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                      {userRoleLabels[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge tone={toneForUserStatus(u.status)}>
                      {userStatusLabels[u.status]}
                    </StatusBadge>
                  </td>
                  <td className="hidden px-4 py-3.5 text-muted-foreground lg:table-cell">
                    {u.lastAccess ? (
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDateTime(u.lastAccess)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">
                        Sin accesos
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
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
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem>
                          <Mail className="mr-2 h-4 w-4" /> Reenviar invitación
                        </DropdownMenuItem>
                        <DropdownMenuItem>Editar rol</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                          Desactivar usuario
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
