'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, LogOut, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { tenantHref, tenantNavItems } from '@/lib/pharmacies/tenant-nav';
import { BrandLogo, PharmacyLogo } from '@/components/brand';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { signOutAction } from '@/app/auth/actions';

export type TenantShellUser = {
  name: string;
  email: string;
  roleLabel: string;
};

export type TenantShellPharmacy = {
  id: string;
  name: string;
  logoUrl: string | null;
  logoColor: string | null;
};

interface PharmacyTenantSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  pharmacy: TenantShellPharmacy;
  user: TenantShellUser;
}

export function PharmacyTenantSidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  pharmacy,
  user,
}: PharmacyTenantSidebarProps) {
  const pathname = usePathname();
  const userInitials = initials(user.name || user.email);
  const pharmacyId = pharmacy.id;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width,transform] duration-300 ease-out lg:translate-x-0',
          collapsed ? 'lg:w-[76px]' : 'lg:w-[256px]',
          'w-[260px]',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <div className={cn(collapsed && 'lg:hidden')}>
            <BrandLogo size={36} showTagline />
          </div>
          <div className={cn('hidden', collapsed && 'lg:flex lg:justify-center')}>
            <BrandLogo variant="mark" size={36} />
          </div>
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className={cn(
            'mx-3 mb-2 flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/50 px-2.5 py-2',
            collapsed && 'lg:justify-center lg:px-1.5'
          )}
        >
          <PharmacyLogo
            name={pharmacy.name}
            logoUrl={pharmacy.logoUrl}
            logoColor={pharmacy.logoColor || '#0d9488'}
            size={collapsed ? 32 : 36}
            rounded="xl"
          />
          <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
            <p className="truncate text-sm font-semibold text-foreground">
              {pharmacy.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.roleLabel}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-1">
            {tenantNavItems.map((item) => {
              const href = tenantHref(pharmacyId, item.segment);
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              const Icon = item.icon;
              return (
                <li key={item.segment}>
                  <Link
                    href={href}
                    title={collapsed ? item.label : undefined}
                    onClick={onMobileClose}
                    className={cn(
                      'group relative flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                      collapsed && 'lg:justify-center lg:px-0',
                      active
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-muted hover:bg-accent/60 hover:text-sidebar-foreground'
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary lg:block" />
                    )}
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0',
                        active
                          ? 'text-primary'
                          : 'text-sidebar-muted group-hover:text-sidebar-foreground'
                      )}
                    />
                    <span className={cn(collapsed && 'lg:hidden')}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border px-3 py-3">
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg px-2 py-2',
              collapsed && 'lg:justify-center lg:px-0'
            )}
          >
            <Avatar className="h-8 w-8 border border-border">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
              <p className="truncate text-sm font-medium text-foreground">
                {user.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  const supabase = createClient();
                  await supabase.auth
                    .signOut({ scope: 'local' })
                    .catch(() => undefined);
                  await signOutAction();
                })();
              }}
              className={cn(
                'rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground',
                collapsed && 'lg:hidden'
              )}
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="hidden h-9 items-center justify-center border-t border-sidebar-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex"
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          <ChevronsLeft
            className={cn(
              'h-4 w-4 transition-transform',
              collapsed && 'rotate-180'
            )}
          />
        </button>
      </aside>
    </>
  );
}
