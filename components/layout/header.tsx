'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  HelpCircle,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  User,
  LogOut,
  ChevronsUpDown,
  Check,
  Store,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Breadcrumbs } from './breadcrumbs';
import { BrandLogo, PharmacyLogo } from '@/components/brand';
import { pharmacies } from '@/lib/mock-data';
import { initials } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import { signOutAction } from '@/app/auth/actions';
import type { ShellUser } from './app-shell';

interface HeaderProps {
  onMobileMenu: () => void;
  user: ShellUser;
}

export function Header({ onMobileMenu, user }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();
  React.useEffect(() => setMounted(true), []);

  const [selectedPharmacy, setSelectedPharmacy] = React.useState(pharmacies[0]);
  const userInitials = initials(user.name || user.email);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full min-w-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-md sm:gap-3 lg:px-6">
      <button
        onClick={onMobileMenu}
        className="shrink-0 rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="shrink-0 lg:hidden">
        <BrandLogo variant="mark" size={32} />
      </div>

      {/* Selector mock: solo en xl+ para no comprimir el header en 1280–1440 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="hidden max-w-[148px] shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent xl:flex"
          >
            <PharmacyLogo
              name={selectedPharmacy.name}
              logoColor={selectedPharmacy.logoColor}
              size={24}
              rounded="lg"
            />
            <span className="min-w-0 truncate">{selectedPharmacy.name}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64" collisionPadding={12}>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Farmacias
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {pharmacies.slice(0, 6).map((p) => (
            <DropdownMenuItem
              key={p.id}
              onClick={() => setSelectedPharmacy(p)}
              className="gap-2.5"
            >
              <PharmacyLogo
                name={p.name}
                logoColor={p.logoColor}
                size={28}
                rounded="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.city}, {p.province}
                </p>
              </div>
              {selectedPharmacy.id === p.id && (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => router.push('/farmacias')}
            className="gap-2 text-primary"
          >
            <Store className="h-4 w-4" /> Ver todas las farmacias
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="hidden min-w-0 flex-1 overflow-hidden lg:block">
        <Breadcrumbs className="min-w-0" />
      </div>

      {/* Buscador: crece/encoge sin empujar acciones */}
      <div className="relative ml-auto hidden min-w-0 max-w-[220px] flex-1 md:block lg:max-w-xs xl:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar…"
          className="h-9 border-border bg-muted/40 pl-9 text-sm focus-visible:bg-background"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 select-none rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground xl:inline-block">
          ⌘K
        </kbd>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1 md:ml-1">
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

        <Button
          variant="ghost"
          size="icon"
          className="hidden h-9 w-9 text-muted-foreground sm:inline-flex"
          aria-label="Ayuda"
          onClick={() => router.push('/ayuda')}
        >
          <HelpCircle className="h-[18px] w-[18px]" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-muted-foreground"
          aria-label="Notificaciones"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
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
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/perfil')}>
              <User className="mr-2 h-4 w-4" /> Mi perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/configuracion')}>
              <Settings className="mr-2 h-4 w-4" /> Configuración
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/ayuda')}>
              <HelpCircle className="mr-2 h-4 w-4" /> Ayuda
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                void (async () => {
                  const supabase = createClient();
                  await supabase.auth
                    .signOut({ scope: 'local' })
                    .catch(() => undefined);
                  await signOutAction();
                })();
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
