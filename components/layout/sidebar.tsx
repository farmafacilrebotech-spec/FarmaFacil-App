'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, LifeBuoy, LogOut, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { navItems, helpItems } from '@/lib/navigation';
import { BrandLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials } from '@/lib/format';
import { signOutAction } from '@/app/auth/actions';
import type { ShellUser } from './app-shell';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  user: ShellUser;
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  user,
}: SidebarProps) {
  const pathname = usePathname();
  const userInitials = initials(user.name || user.email);

  return (
    <>
      {/* Mobile overlay */}
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
        {/* Brand */}
        <div className="flex h-16 items-center justify-between px-4">
          <div className={cn(collapsed && 'lg:hidden')}>
            <BrandLogo size={36} showTagline />
          </div>
          <div className={cn('hidden', collapsed && 'lg:flex lg:justify-center')}>
            <BrandLogo variant="mark" size={36} />
          </div>
          <button
            onClick={onMobileClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-1">
            {navItems
              .filter((item) => !item.superAdminOnly)
              .map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
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
                          active ? 'text-primary' : 'text-sidebar-muted group-hover:text-sidebar-foreground'
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

        {/* Footer */}
        <div className="border-t border-sidebar-border px-3 py-3">
          <ul className="space-y-1">
            {helpItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-accent/60 hover:text-sidebar-foreground',
                      collapsed && 'lg:justify-center lg:px-0'
                    )}
                  >
                    <LifeBuoy className="h-[18px] w-[18px] shrink-0" />
                    <span className={cn('whitespace-nowrap', collapsed && 'lg:hidden')}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* User */}
          <div
            className={cn(
              'mt-3 flex items-center gap-3 rounded-lg px-2 py-2',
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
              onClick={() => void signOutAction()}
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

        {/* Collapse toggle (desktop) */}
        <button
          onClick={onToggle}
          className="hidden h-9 items-center justify-center border-t border-sidebar-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex"
          aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
        >
          <ChevronsLeft
            className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')}
          />
        </button>
      </aside>
    </>
  );
}
