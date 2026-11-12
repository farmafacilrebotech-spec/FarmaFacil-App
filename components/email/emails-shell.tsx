'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileText,
  Inbox,
  Mail,
  PenLine,
  Send,
  Trash2,
  LayoutTemplate,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/emails/inbox', label: 'Recibidos', icon: Inbox },
  { href: '/emails/sends', label: 'Enviados', icon: Send },
  { href: '/emails/drafts', label: 'Borradores', icon: FileText },
  { href: '/emails/templates', label: 'Plantillas', icon: LayoutTemplate },
  { href: '/emails/trash', label: 'Papelera', icon: Trash2 },
] as const;

export function EmailsShell({
  children,
  title,
  description,
  searchSlot,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  searchSlot?: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 lg:flex-row lg:gap-6">
      <aside className="w-full shrink-0 space-y-3 lg:w-52">
        <Button asChild className="w-full justify-start gap-2">
          <Link href="/emails/compose">
            <PenLine className="h-4 w-4" />
            Nuevo email
          </Link>
        </Button>
        <nav className="rounded-xl border border-border bg-card p-1 shadow-soft">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/emails/inbox' &&
                pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/emails"
          className="flex items-center gap-2 px-3 text-xs text-muted-foreground hover:text-foreground"
        >
          <Mail className="h-3.5 w-3.5" />
          Resumen
        </Link>
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {searchSlot}
        </div>
        {children}
      </div>
    </div>
  );
}
