'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Download,
  Plus,
  Upload,
  Store,
  Users,
  ShoppingCart,
  Tag,
} from 'lucide-react';

import { kpis, salesChart, clientsChart, activity, pharmacies, recentOrders } from '@/lib/mock-data';
import { planLabels, statusLabels, orderStatusLabels } from '@/lib/mock-data';
import { formatCurrency, formatNumber, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCard } from '@/components/shared/kpi-card';
import { AreaChartCard } from '@/components/shared/area-chart-card';
import { BarChartCard } from '@/components/shared/bar-chart-card';
import { ActivityFeed } from '@/components/shared/activity-feed';
import { StatusBadge, toneForPharmacyStatus, toneForOrderStatus } from '@/components/shared/status-badge';
import { PharmacyLogo } from '@/components/brand';
import { DataTable, type Column } from '@/components/shared/data-table';
import type { Pharmacy, Order } from '@/lib/types';

const quickActions = [
  { label: 'Nueva farmacia', icon: Store, href: '/farmacias' },
  { label: 'Nuevo cliente', icon: Users, href: '/clientes' },
  { label: 'Nuevo pedido', icon: ShoppingCart, href: '/pedidos' },
  { label: 'Nueva promoción', icon: Tag, href: '/promociones' },
];

const pharmacyColumns: Column<Pharmacy>[] = [
  {
    key: 'name',
    header: 'Farmacia',
    sortable: true,
    sortAccessor: (r) => r.name,
    cell: (r) => (
      <div className="flex items-center gap-3">
        <PharmacyLogo name={r.name} logoColor={r.logoColor} size={36} />
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {r.city}, {r.province}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Estado',
    sortable: true,
    sortAccessor: (r) => r.status,
    cell: (r) => (
      <StatusBadge tone={toneForPharmacyStatus(r.status)}>
        {statusLabels[r.status]}
      </StatusBadge>
    ),
  },
  {
    key: 'clients',
    header: 'Clientes',
    sortable: true,
    sortAccessor: (r) => r.clients,
    align: 'right',
    hideOnMobile: true,
    cell: (r) => formatNumber(r.clients),
  },
  {
    key: 'orders',
    header: 'Pedidos',
    sortable: true,
    sortAccessor: (r) => r.orders,
    align: 'right',
    hideOnMobile: true,
    cell: (r) => formatNumber(r.orders),
  },
  {
    key: 'joinedAt',
    header: 'Alta',
    sortable: true,
    sortAccessor: (r) => r.joinedAt,
    hideOnMobile: true,
    cell: (r) => formatDate(r.joinedAt),
  },
  {
    key: 'plan',
    header: 'Plan',
    sortable: true,
    sortAccessor: (r) => r.plan,
    cell: (r) => (
      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
        {planLabels[r.plan]}
      </span>
    ),
  },
];

const orderColumns: Column<Order>[] = [
  {
    key: 'code',
    header: 'Pedido',
    sortable: true,
    sortAccessor: (r) => r.code,
    cell: (r) => (
      <span className="font-medium text-foreground">{r.code}</span>
    ),
  },
  {
    key: 'clientName',
    header: 'Cliente',
    sortable: true,
    sortAccessor: (r) => r.clientName,
    hideOnMobile: true,
    cell: (r) => r.clientName,
  },
  {
    key: 'pharmacyName',
    header: 'Farmacia',
    hideOnMobile: true,
    cell: (r) => r.pharmacyName,
  },
  {
    key: 'status',
    header: 'Estado',
    sortable: true,
    sortAccessor: (r) => r.status,
    cell: (r) => (
      <StatusBadge tone={toneForOrderStatus(r.status)}>
        {orderStatusLabels[r.status]}
      </StatusBadge>
    ),
  },
  {
    key: 'total',
    header: 'Importe',
    sortable: true,
    sortAccessor: (r) => r.total,
    align: 'right',
    cell: (r) => (
      <span className="font-medium text-foreground">{formatCurrency(r.total)}</span>
    ),
  },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        title="Dashboard"
        description="Resumen general del estado de tu red de farmacias"
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Nueva farmacia
            </Button>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 stagger">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 animate-slide-up">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Ventas y pedidos
              </h3>
              <p className="text-xs text-muted-foreground">Últimos 8 meses</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-chart-1" /> Ventas (k€)
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-chart-5" /> Pedidos (k)
              </span>
            </div>
          </div>
          <div className="p-3 pr-5">
            <AreaChartCard
              data={salesChart}
              series={[
                { key: 'ventas', color: 'hsl(var(--chart-1))', label: 'Ventas' },
                { key: 'pedidos', color: 'hsl(var(--chart-5))', label: 'Pedidos' },
              ]}
              valueFormatter={(v) => `${v}`}
            />
          </div>
        </Card>

        <Card className="animate-slide-up">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Nuevos clientes
              </h3>
              <p className="text-xs text-muted-foreground">Por mes</p>
            </div>
          </div>
          <div className="p-3 pr-5">
            <BarChartCard
              data={clientsChart}
              dataKey="nuevos"
              color="hsl(var(--chart-2))"
            />
          </div>
        </Card>
      </div>

      {/* Activity + Quick actions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 animate-slide-up">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h3 className="text-base font-semibold text-foreground">
              Últimas farmacias
            </h3>
            <Link
              href="/farmacias"
              className="flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
            >
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="p-4">
            <DataTable
              columns={pharmacyColumns}
              data={pharmacies}
              rowKey={(r) => r.id}
              searchable={false}
              pageSize={5}
            />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="animate-slide-up p-5">
            <h3 className="text-base font-semibold text-foreground">
              Acciones rápidas
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Atajos a las tareas más habituales
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {quickActions.map((a) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="group flex flex-col items-start gap-2 rounded-lg border border-border bg-background p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {a.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="animate-slide-up p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">
                Actividad reciente
              </h3>
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                Ver todo
              </Button>
            </div>
            <div className="mt-3">
              <ActivityFeed items={activity} />
            </div>
          </Card>
        </div>
      </div>

      {/* Recent orders */}
      <Card className="animate-slide-up">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h3 className="text-base font-semibold text-foreground">
            Pedidos recientes
          </h3>
          <Link
            href="/pedidos"
            className="flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
          >
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="p-4">
          <DataTable
            columns={orderColumns}
            data={recentOrders}
            rowKey={(r) => r.id}
            searchable={false}
            pageSize={5}
          />
        </div>
      </Card>
    </div>
  );
}
