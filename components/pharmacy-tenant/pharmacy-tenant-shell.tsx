'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { displayNameFromIdentity } from '@/lib/format';
import { pharmacyRoleLabel } from '@/lib/pharmacies/role-labels';
import type { PharmacyTenantContext } from '@/lib/pharmacies/tenant';
import { PharmacyTenantSidebar } from './pharmacy-tenant-sidebar';
import { PharmacyTenantHeader } from './pharmacy-tenant-header';
import Link from 'next/link';
import { PendingInvitationsList } from '@/components/auth/pending-invitations-list';

export function PharmacyTenantShell({
  context,
  children,
}: {
  context: PharmacyTenantContext;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const user = {
    name: displayNameFromIdentity(
      context.profile.fullName,
      context.profile.email
    ),
    email: context.profile.email,
    roleLabel: pharmacyRoleLabel(context.membership.roleKey),
  };

  const pharmacy = {
    id: context.pharmacy.id,
    name: context.pharmacy.name,
    logoUrl: context.pharmacy.logoUrl,
    logoColor: context.pharmacy.logoColor,
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <PharmacyTenantSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        pharmacy={pharmacy}
        user={user}
      />
      <div
        className={cn(
          'flex min-h-screen min-w-0 flex-col transition-[padding] duration-300 ease-out',
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-[256px]'
        )}
      >
        <PharmacyTenantHeader
          onMobileMenu={() => setMobileOpen(true)}
          pharmacy={pharmacy}
          user={user}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 lg:px-8 lg:py-8">
          {context.pendingInvitations.length > 0 ? (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-50">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium">
                  Tienes {context.pendingInvitations.length === 1
                    ? 'una invitación pendiente'
                    : `${context.pendingInvitations.length} invitaciones pendientes`}{' '}
                  a otra farmacia.
                </p>
                <Link
                  href="/auth/invitations"
                  className="text-sm font-medium underline underline-offset-2"
                >
                  Ver invitaciones
                </Link>
              </div>
              <PendingInvitationsList invitations={context.pendingInvitations} />
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
