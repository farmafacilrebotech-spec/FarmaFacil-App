'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, Plus, Upload, UserCog, MoreHorizontal, Eye, Pencil, Ban } from 'lucide-react';

import { users, userRoleLabels, userStatusLabels } from '@/lib/mock-data';
import { formatDateTime, formatDate, initials } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import { StatusBadge, toneForUserStatus } from '@/components/shared/status-badge';
import type { UserAccount } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const roleTone: Record<string, 'primary' | 'success' | 'warning' | 'neutral'> = {
  superadmin: 'primary',
  pharmacy_admin: 'success',
  employee: 'warning',
  client: 'neutral',
};

const columns: Column<UserAccount>[] = [
  {
    key: 'name',
    header: 'Usuario',
    sortable: true,
    sortAccessor: (r) => r.name,
    cell: (r) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 border border-border">
          <AvatarFallback
            className="text-xs font-semibold"
            style={{ backgroundColor: `${r.avatarColor}15`, color: r.avatarColor }}
          >
            {initials(r.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">{r.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'role',
    header: 'Rol',
    sortable: true,
    sortAccessor: (r) => r.role,
    hideOnMobile: true,
    cell: (r) => (
      <StatusBadge tone={roleTone[r.role] ?? 'neutral'} dot={false}>
        {userRoleLabels[r.role]}
      </StatusBadge>
    ),
  },
  {
    key: 'pharmacyName',
    header: 'Farmacia',
    sortable: true,
    sortAccessor: (r) => r.pharmacyName ?? '',
    hideOnMobile: true,
    cell: (r) =>
      r.pharmacyName ? (
        <span className="text-muted-foreground">{r.pharmacyName}</span>
      ) : (
        <span className="text-muted-foreground/50">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Estado',
    sortable: true,
    sortAccessor: (r) => r.status,
    cell: (r) => (
      <StatusBadge tone={toneForUserStatus(r.status)}>
        {userStatusLabels[r.status]}
      </StatusBadge>
    ),
  },
  {
    key: 'lastAccess',
    header: 'Último acceso',
    sortable: true,
    sortAccessor: (r) => r.lastAccess ?? '',
    hideOnMobile: true,
    cell: (r) =>
      r.lastAccess ? (
        <span className="text-muted-foreground">{formatDateTime(r.lastAccess)}</span>
      ) : (
        <span className="text-muted-foreground/50">Sin accesos</span>
      ),
  },
  {
    key: 'createdAt',
    header: 'Fecha creación',
    sortable: true,
    sortAccessor: (r) => r.createdAt,
    hideOnMobile: true,
    cell: (r) => <span className="text-muted-foreground">{formatDate(r.createdAt)}</span>,
  },
  {
    key: 'actions',
    header: '',
    align: 'right',
    cell: (r) => <RowActions user={r} />,
  },
];

function RowActions({ user }: { user: UserAccount }) {
  const router = useRouter();
  return (
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
        <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(`/usuarios/${user.id}`)}>
          <Eye className="mr-2 h-4 w-4" /> Ver ficha
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive">
          <Ban className="mr-2 h-4 w-4" /> Suspender
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function UsuariosPage() {
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const router = useRouter();

  const filtered = React.useMemo(
    () =>
      users.filter((u) => {
        if (roleFilter !== 'all' && u.role !== roleFilter) return false;
        if (statusFilter !== 'all' && u.status !== statusFilter) return false;
        return true;
      }),
    [roleFilter, statusFilter]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Usuarios"
        description="Gestiona los usuarios y permisos de la plataforma"
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" /> Importar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Nuevo usuario
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/usuarios/${r.id}`)}
        searchAccessor={(r) => `${r.name} ${r.email} ${r.pharmacyName ?? ''}`}
        searchPlaceholder="Buscar por nombre, email, farmacia…"
        pageSize={8}
        toolbar={
          <>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 w-[170px] text-sm">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {Object.entries(userRoleLabels)
                  .filter(([k]) => k !== 'admin')
                  .map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[170px] text-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(userStatusLabels)
                  .filter(([k]) => !['invited', 'disabled'].includes(k))
                  .map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </>
        }
        empty={
          <div className="flex flex-col items-center gap-3 py-8">
            <UserCog className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No se encontraron usuarios con esos criterios.
            </p>
          </div>
        }
      />
    </div>
  );
}
