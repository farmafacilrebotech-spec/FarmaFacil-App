'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { displayNameFromIdentity } from '@/lib/format';
import { pharmacyRoleLabel } from '@/lib/pharmacies/role-labels';
import type { PharmacyTenantContext } from '@/lib/pharmacies/tenant';
import { PharmacyTenantSidebar } from './pharmacy-tenant-sidebar';
import { PharmacyTenantHeader } from './pharmacy-tenant-header';

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
          {children}
        </main>
      </div>
    </div>
  );
}
