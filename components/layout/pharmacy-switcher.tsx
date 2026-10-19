'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronsUpDown, Store } from 'lucide-react';

import { PharmacyLogo } from '@/components/brand';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  pharmacySwitcherMode,
  type ShellPharmacyOption,
} from '@/lib/pharmacies/shell-pharmacies';
import { pharmacyRoleLabel } from '@/lib/pharmacies/role-labels';

type PharmacySwitcherProps = {
  pharmacies: ShellPharmacyOption[];
  /** Farmacia actualmente seleccionada / en contexto. */
  currentId?: string | null;
  /**
   * Destino al elegir una farmacia.
   * SuperAdmin → /farmacias/:id · Tenant → /f/:id/dashboard
   */
  hrefForPharmacy: (pharmacyId: string) => string;
  /** Enlace opcional «Ver todas» (solo SuperAdmin). */
  viewAllHref?: string;
  className?: string;
};

export function PharmacySwitcher({
  pharmacies,
  currentId,
  hrefForPharmacy,
  viewAllHref,
  className,
}: PharmacySwitcherProps) {
  const router = useRouter();
  const mode = pharmacySwitcherMode(pharmacies);
  const current =
    pharmacies.find((p) => p.id === currentId) ?? pharmacies[0] ?? null;

  if (mode === 'hidden' || !current) {
    return null;
  }

  if (mode === 'static') {
    return (
      <div
        className={
          className ??
          'hidden max-w-[200px] shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground xl:flex'
        }
      >
        <PharmacyLogo
          name={current.name}
          logoUrl={current.logoUrl ?? null}
          logoColor={current.logoColor || '#0d9488'}
          size={24}
          rounded="lg"
        />
        <span className="min-w-0 truncate">{current.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={
            className ??
            'hidden max-w-[200px] shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent xl:flex'
          }
        >
          <PharmacyLogo
            name={current.name}
            logoUrl={current.logoUrl ?? null}
            logoColor={current.logoColor || '#0d9488'}
            size={24}
            rounded="lg"
          />
          <span className="min-w-0 truncate">{current.name}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" collisionPadding={12}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Farmacias autorizadas
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {pharmacies.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => {
              if (p.id === current.id) return;
              router.push(hrefForPharmacy(p.id));
            }}
            className="gap-2.5"
          >
            <PharmacyLogo
              name={p.name}
              logoUrl={p.logoUrl ?? null}
              logoColor={p.logoColor || '#0d9488'}
              size={28}
              rounded="lg"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[
                  p.roleKey ? pharmacyRoleLabel(p.roleKey) : p.roleName,
                  p.city || p.province
                    ? [p.city, p.province].filter(Boolean).join(', ')
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Farmacia'}
              </p>
            </div>
            {current.id === p.id ? (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
        {viewAllHref ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push(viewAllHref)}
              className="gap-2 text-primary"
            >
              <Store className="h-4 w-4" /> Ver todas las farmacias
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
