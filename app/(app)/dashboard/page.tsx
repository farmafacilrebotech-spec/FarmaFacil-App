import Link from 'next/link';
import {
  ArrowRight,
  Plus,
  Store,
  Users,
  ShoppingCart,
  Tag,
} from 'lucide-react';

import { listPharmacies } from '@/lib/pharmacies/queries';
import { PHARMACY_STATUS_LABELS } from '@/lib/pharmacies/labels';
import { formatDate, formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import {
  StatusBadge,
  toneForPharmacyStatus,
} from '@/components/shared/status-badge';
import { PharmacyLogo } from '@/components/brand';

export const dynamic = 'force-dynamic';

const quickActions: Array<{
  label: string;
  icon: typeof Store;
  href?: string;
  enabled: boolean;
}> = [
  {
    label: 'Nueva farmacia',
    icon: Store,
    href: '/farmacias/nueva',
    enabled: true,
  },
  { label: 'Nuevo cliente', icon: Users, enabled: false },
  { label: 'Nuevo pedido', icon: ShoppingCart, enabled: false },
  { label: 'Nueva promoción', icon: Tag, enabled: false },
];

export default async function DashboardPage() {
  const pharmacies = await listPharmacies();
  const activeCount = pharmacies.filter((p) => p.status === 'active').length;
  const recentPharmacies = pharmacies.slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-8">
      <PageHeader
        title="Dashboard"
        description="Resumen general del estado de tu red de farmacias"
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5" disabled>
              Exportar
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/farmacias/nueva">
                <Plus className="h-4 w-4" /> Nueva farmacia
              </Link>
            </Button>
          </>
        }
      />

      {/* KPIs: solo datos reales; el resto pendiente */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5 shadow-soft">
          <p className="text-sm font-medium text-muted-foreground">
            Farmacias activas
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {formatNumber(activeCount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatNumber(pharmacies.length)} en total
          </p>
        </Card>
        <Card className="p-5 shadow-soft">
          <p className="text-sm font-medium text-muted-foreground">Clientes</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-muted-foreground">
            —
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pendiente de implementar
          </p>
        </Card>
        <Card className="p-5 shadow-soft">
          <p className="text-sm font-medium text-muted-foreground">Pedidos</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-muted-foreground">
            —
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pendiente de implementar
          </p>
        </Card>
        <Card className="p-5 shadow-soft">
          <p className="text-sm font-medium text-muted-foreground">
            Facturación mensual
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-muted-foreground">
            —
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sin datos disponibles
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-3">
        <Card className="min-w-0 overflow-hidden 2xl:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-border p-5">
            <h3 className="text-base font-semibold text-foreground">
              Últimas farmacias
            </h3>
            <Link
              href="/farmacias"
              className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
            >
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recentPharmacies.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Todavía no hay farmacias. Crea la primera con «Nueva farmacia».
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Farmacia
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Estado
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                      Plan
                    </th>
                    <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell">
                      Alta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentPharmacies.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                    >
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/farmacias/${p.id}`}
                          className="flex items-center gap-3"
                        >
                          <PharmacyLogo
                            name={p.name}
                            logoColor={p.logo_color || '#2EC4C7'}
                            size={36}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {p.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[p.city, p.province].filter(Boolean).join(', ') ||
                                '—'}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge tone={toneForPharmacyStatus(p.status)}>
                          {PHARMACY_STATUS_LABELS[p.status] ?? p.status}
                        </StatusBadge>
                      </td>
                      <td className="hidden px-4 py-3.5 md:table-cell">
                        <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
                          {p.plan?.name ?? '—'}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3.5 text-muted-foreground lg:table-cell">
                        {formatDate(p.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="grid min-w-0 grid-cols-1 gap-4">
          <Card className="min-w-0 p-5">
            <h3 className="text-base font-semibold text-foreground">
              Acciones rápidas
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Atajos a las tareas disponibles
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {quickActions.map((a) => {
                const Icon = a.icon;
                if (!a.enabled || !a.href) {
                  return (
                    <div
                      key={a.label}
                      aria-disabled
                      className="flex flex-col items-start gap-2 rounded-lg border border-border bg-muted/30 p-3.5 opacity-60"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="text-sm font-medium leading-snug text-muted-foreground">
                        {a.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Pendiente
                      </span>
                    </div>
                  );
                }
                return (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="group flex flex-col items-start gap-2 rounded-lg border border-border bg-background p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="text-sm font-medium leading-snug text-foreground">
                      {a.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="min-w-0 p-5">
            <h3 className="text-base font-semibold text-foreground">
              Actividad reciente
            </h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Sin datos disponibles. Pendiente de implementar.
            </p>
          </Card>
        </div>
      </div>

      <Card className="min-w-0 p-5">
        <h3 className="text-base font-semibold text-foreground">
          Pedidos recientes
        </h3>
        <p className="mt-3 text-sm text-muted-foreground">
          Sin datos disponibles. Pendiente de implementar.
        </p>
      </Card>
    </div>
  );
}
