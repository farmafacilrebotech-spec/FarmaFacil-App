import Link from 'next/link';
import { Settings } from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  {
    title: 'Configuración global FarmaFácil',
    body: 'Preferencias de plataforma (marca corporativa web, políticas). No hay tabla platform_settings; el branding operativo se gestiona por farmacia.',
    links: [
      { href: '/emails', label: 'Emails corporativos' },
      { href: '/usuarios', label: 'Usuarios plataforma' },
    ],
  },
  {
    title: 'Configuración individual de farmacia',
    body: 'Datos, branding, catálogo y dispositivos en la ficha y en /f/{id}/configuracion.',
    links: [
      { href: '/farmacias', label: 'Listado de farmacias' },
    ],
  },
  {
    title: 'Parámetros comerciales',
    body: 'Planes comerciales aprobados: General, Personalizado e IA (+ Piloto). Tarifas y presupuestos en simulador. Starter/Business/Enterprise son legacy interno del kernel.',
    links: [
      { href: '/tarifas', label: 'Tarifas y simulador' },
      { href: '/contratos', label: 'Suscripciones / contratos' },
    ],
  },
  {
    title: 'Permisos y seguridad',
    body: 'RBAC plataforma (SuperAdmin / Support) y roles de farmacia. Secretos solo en variables de entorno (nunca en UI).',
    links: [
      { href: '/usuarios', label: 'Roles plataforma' },
    ],
  },
] as const;

export default function ConfiguracionPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Configuración"
        description="Mapa de ajustes reales. Sin pantalla ficticia ni secretos."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <section
            key={s.title}
            className="rounded-xl border border-border bg-card p-5 shadow-soft"
          >
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Settings className="h-4 w-4 text-muted-foreground" />
              {s.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            <ul className="mt-3 space-y-1 text-sm">
              {s.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
