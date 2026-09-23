'use client';

import * as React from 'react';
import { Menu, LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

import { BrandLogo, PharmacyLogo } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { initials } from '@/lib/format';
import { signOutAction } from '@/app/auth/actions';
import type {
  TenantShellPharmacy,
  TenantShellUser,
} from './pharmacy-tenant-sidebar';

interface PharmacyTenantHeaderProps {
  onMobileMenu: () => void;
  pharmacy: TenantShellPharmacy;
  user: TenantShellUser;
}

export function PharmacyTenantHeader({
  onMobileMenu,
  pharmacy,
  user,
}: PharmacyTenantHeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const userInitials = initials(user.name || user.email);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full min-w-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:gap-3 lg:px-6">
      <button
        type="button"
        onClick={onMobileMenu}
        className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="shrink-0 lg:hidden">
        <BrandLogo variant="mark" size={32} />
      </div>

      <div className="hidden min-w-0 items-center gap-2.5 lg:flex">
        <PharmacyLogo
          name={pharmacy.name}
          logoUrl={pharmacy.logoUrl}
          logoColor={pharmacy.logoColor || '#0d9488'}
          size={28}
          rounded="lg"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {pharmacy.name}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 font-medium">
          {user.roleLabel}
        </Badge>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Cambiar tema"
        >
          {mounted && theme === 'dark' ? (
            <Sun className="h-[18px] w-[18px]" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </Button>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex shrink-0 items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-accent"
              aria-label="Menú de usuario"
            >
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            collisionPadding={12}
            className="w-56 max-w-[calc(100vw-1.5rem)]"
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold text-foreground">
                  {user.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  {user.roleLabel} · {pharmacy.name}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                void signOutAction();
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
