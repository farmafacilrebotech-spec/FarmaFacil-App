'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';

const labels: Record<string, string> = {
  dashboard: 'Dashboard',
  farmacias: 'Farmacias',
  clientes: 'Clientes',
  catalogo: 'Catálogo',
  pedidos: 'Pedidos',
  promociones: 'Promociones',
  contratos: 'Contratos',
  configuracion: 'Configuración',
  ayuda: 'Centro de ayuda',
  usuarios: 'Usuarios',
  perfil: 'Mi perfil',
  nueva: 'Nueva',
  login: 'Acceso',
};

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const items = segments.map((seg, i) => ({
    label: labels[seg] ?? seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
    last: i === segments.length - 1,
  }));

  return (
    <nav
      aria-label="Ruta de navegación"
      className={cn('flex min-w-0 items-center text-sm', className)}
    >
      <ol className="flex min-w-0 items-center gap-1.5 overflow-hidden">
        {items.map((item, i) => (
          <li
            key={item.href}
            className={cn(
              'flex min-w-0 items-center gap-1.5',
              item.last ? 'min-w-0' : 'shrink-0'
            )}
          >
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            )}
            {item.last ? (
              <span
                className="block truncate font-medium text-foreground"
                aria-current="page"
                title={item.label}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="shrink-0 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
