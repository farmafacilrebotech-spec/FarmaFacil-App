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

interface HeaderProps {
  onMobileMenu: () => void;
}

export function Header({ onMobileMenu }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const router = useRouter();
  React.useEffect(() => setMounted(true), []);

  const [selectedPharmacy, setSelectedPharmacy] = React.useState(pharmacies[0]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md lg:px-6">
      <button
        onClick={onMobileMenu}
        className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="lg:hidden">
        <BrandLogo variant="mark" size={32} />
      </div>

      {/* Pharmacy selector — Vercel-style team switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="hidden items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent lg:flex">
            <PharmacyLogo
              name={selectedPharmacy.name}
              logoColor={selectedPharmacy.logoColor}
              size={24}
              rounded="lg"
            />
            <span className="max-w-[140px] truncate">{selectedPharmacy.name}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
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
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.city}, {p.province}
                </p>
              </div>
              {selectedPharmacy.id === p.id && (
                <Check className="h-4 w-4 text-primary" />
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

      <div className="hidden lg:block">
        <Breadcrumbs />
      </div>

      {/* Global search */}
      <div className="relative ml-auto hidden w-full max-w-sm md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar farmacias, clientes, pedidos…"
          className="h-9 border-border bg-muted/40 pl-9 text-sm focus-visible:bg-background"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 select-none rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline-block">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1 md:ml-3">
        {/* Theme toggle */}
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
          className="h-9 w-9 text-muted-foreground"
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

        <div className="mx-1 h-6 w-px bg-border" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-accent"
              aria-label="Menú de usuario"
            >
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  AF
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">Admin FarmaFácil</span>
                <span className="text-xs font-normal text-muted-foreground">
                  admin@farmafacil.es
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
              onClick={() => router.push('/login')}
            >
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
