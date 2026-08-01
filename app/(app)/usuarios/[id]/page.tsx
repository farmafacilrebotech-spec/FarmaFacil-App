'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  Clock,
  Shield,
  Activity,
  Pencil,
  MoreHorizontal,
  Ban,
  LogIn,
  LogOut,
  FilePlus,
  FileEdit,
  Trash2,
  MailOpen,
  Settings,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { users, userRoleLabels, userStatusLabels, permissionGroups } from '@/lib/mock-data';
import { formatDateTime, formatDate, initials } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import {
  StatusBadge,
  toneForUserStatus,
} from '@/components/shared/status-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserActivityItem } from '@/lib/types';

const tabs = [
  { id: 'datos', label: 'Datos personales', icon: User },
  { id: 'actividad', label: 'Actividad reciente', icon: Activity },
  { id: 'permisos', label: 'Permisos', icon: Shield },
] as const;

const activityIcons: Record<UserActivityItem['type'], LucideIcon> = {
  login: LogIn,
  logout: LogOut,
  create: FilePlus,
  update: FileEdit,
  delete: Trash2,
  invite: MailOpen,
  config: Settings,
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = users.find((u) => u.id === params.id);
  const [activeTab, setActiveTab] = React.useState<string>('datos');
  const [permissions, setPermissions] = React.useState<Record<string, boolean>>(
    user?.permissions ?? {}
  );

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <User className="h-12 w-12 text-muted-foreground/40" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Usuario no encontrado
          </h2>
          <Button asChild className="mt-5" size="sm">
            <Link href="/usuarios">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver a usuarios
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/usuarios"
        className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Usuarios
      </Link>

      {/* Header card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarFallback
                className="text-lg font-semibold"
                style={{ backgroundColor: `${user.avatarColor}15`, color: user.avatarColor }}
              >
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  {user.name}
                </h1>
                <StatusBadge tone={toneForUserStatus(user.status)}>
                  {userStatusLabels[user.status]}
                </StatusBadge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>
                  Rol:{' '}
                  <span className="font-medium text-foreground">
                    {userRoleLabels[user.role]}
                  </span>
                </span>
                {user.pharmacyName && (
                  <span>
                    Farmacia:{' '}
                    <span className="font-medium text-foreground">
                      {user.pharmacyName}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem>Reenviar invitación</DropdownMenuItem>
                <DropdownMenuItem>Restablecer contraseña</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  <Ban className="mr-2 h-4 w-4" /> Suspender usuario
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-border px-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="animate-fade-in" key={activeTab}>
        {activeTab === 'datos' && (
          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2">
              <div className="divide-y divide-border sm:border-r sm:border-border sm:pr-8">
                <InfoRow icon={User} label="Nombre completo" value={user.name} />
                <InfoRow icon={Mail} label="Email" value={user.email} />
                <InfoRow icon={Phone} label="Teléfono" value={user.phone} />
              </div>
              <div className="divide-y divide-border sm:pl-8">
                <InfoRow
                  icon={Shield}
                  label="Rol"
                  value={userRoleLabels[user.role]}
                />
                <InfoRow
                  icon={Building2}
                  label="Farmacia"
                  value={user.pharmacyName ?? '—'}
                />
                <InfoRow
                  icon={Calendar}
                  label="Fecha de creación"
                  value={formatDate(user.createdAt)}
                />
                <InfoRow
                  icon={Clock}
                  label="Último acceso"
                  value={
                    user.lastAccess
                      ? formatDateTime(user.lastAccess)
                      : 'Sin accesos'
                  }
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'actividad' && (
          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            {user.activity.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground">
                  Este usuario aún no tiene actividad registrada.
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-2xl">
                <div className="relative pl-6">
                  <div className="absolute left-[15px] top-2 h-full w-px bg-border" />
                  <ol className="space-y-6">
                    {user.activity.map((item) => {
                      const Icon = activityIcons[item.type];
                      return (
                        <li key={item.id} className="relative">
                          <div className="absolute -left-6 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {item.title}
                              </p>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {item.time}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'permisos' && (
          <div className="space-y-4">
            {permissionGroups.map((group) => (
              <div
                key={group.id}
                className="rounded-xl border border-border bg-card p-5 shadow-soft"
              >
                <div className="mb-1 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {group.label}
                  </h3>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  {group.description}
                </p>
                <div className="space-y-1">
                  {group.permissions.map((perm) => (
                    <div
                      key={perm.id}
                      className="flex items-center justify-between gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {perm.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {perm.description}
                        </p>
                      </div>
                      <Switch
                        checked={permissions[perm.id] ?? false}
                        onCheckedChange={(v) =>
                          setPermissions((p) => ({ ...p, [perm.id]: v }))
                        }
                        disabled={user.role === 'superadmin'}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {user.role === 'superadmin' && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm text-muted-foreground">
                  El rol <strong className="text-foreground">SuperAdministrador</strong> tiene
                  todos los permisos activados por defecto y no pueden modificarse.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
