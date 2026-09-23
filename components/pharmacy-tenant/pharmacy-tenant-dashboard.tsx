import Link from 'next/link';
import {
  ShoppingCart,
  Users,
  Pill,
  Tag,
  Package,
} from 'lucide-react';

import type { PharmacyTenantContext } from '@/lib/pharmacies/tenant';
import { tenantHref } from '@/lib/pharmacies/tenant-nav';
import { pharmacyRoleLabel } from '@/lib/pharmacies/role-labels';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Card } from '@/components/ui/card';

const EMPTY_TREND = [0, 0, 0, 0, 0, 0, 0, 0];

export function PharmacyTenantDashboard({
  context,
}: {
  context: PharmacyTenantContext;
}) {
  const pharmacyId = context.pharmacy.id;
  const roleLabel = pharmacyRoleLabel(context.membership.roleKey);

  const quickLinks = [
    {
      label: 'Pedidos',
      href: tenantHref(pharmacyId, 'pedidos'),
      icon: ShoppingCart,
    },
    {
      label: 'Clientes',
      href: tenantHref(pharmacyId, 'clientes'),
      icon: Users,
    },
    {
      label: 'Catálogo',
      href: tenantHref(pharmacyId, 'catalogo'),
      icon: Pill,
    },
    {
      label: 'Promociones',
      href: tenantHref(pharmacyId, 'promociones'),
      icon: Tag,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Panel de ${context.pharmacy.name} · ${roleLabel}`}
      />

      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Indicadores en cero hasta conectar pedidos, clientes y catálogo de esta
        farmacia. No se muestran datos de demostración.
      </p>

      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Pedidos hoy"
          value="0"
          delta={0}
          trend={EMPTY_TREND}
          icon="today"
          className="min-w-0"
        />
        <KpiCard
          label="Clientes"
          value="0"
          delta={0}
          trend={EMPTY_TREND}
          icon="clients"
          className="min-w-0"
        />
        <KpiCard
          label="Productos"
          value="0"
          delta={0}
          trend={EMPTY_TREND}
          icon="products"
          className="min-w-0"
        />
        <KpiCard
          label="Facturación"
          value="0 €"
          delta={0}
          trend={EMPTY_TREND}
          icon="revenue"
          className="min-w-0"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="min-w-0 xl:col-span-2">
          <div className="border-b border-border p-5">
            <h3 className="text-base font-semibold text-foreground">
              Actividad reciente
            </h3>
            <p className="text-xs text-muted-foreground">
              Pedidos y movimientos de esta farmacia
            </p>
          </div>
          <div className="p-4">
            <EmptyState
              icon={Package}
              title="Sin actividad todavía"
              description="Cuando haya pedidos y movimientos reales, aparecerán aquí."
            />
          </div>
        </Card>

        <Card className="min-w-0 p-5">
          <h3 className="text-base font-semibold text-foreground">
            Accesos rápidos
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Módulos de tu farmacia
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {quickLinks.map((a) => {
              const Icon = a.icon;
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
      </div>
    </div>
  );
}
