'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from './sidebar';
import { Header } from './header';
import type { ShellPharmacyOption } from '@/lib/pharmacies/shell-pharmacies';

export type ShellUser = {
  name: string;
  email: string;
};

export function AppShell({
  children,
  user,
  pharmacies,
}: {
  children: React.ReactNode;
  user: ShellUser;
  pharmacies: ShellPharmacyOption[];
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        user={user}
      />
      <div
        className={cn(
          'flex min-h-screen min-w-0 flex-col transition-[padding] duration-300 ease-out',
          collapsed ? 'lg:pl-[76px]' : 'lg:pl-[256px]'
        )}
      >
        <Header
          onMobileMenu={() => setMobileOpen(true)}
          user={user}
          pharmacies={pharmacies}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
