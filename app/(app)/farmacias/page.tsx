'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  Plus,
  Upload,
  Store,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react';

import { pharmacies, planLabels, statusLabels } from '@/lib/mock-data';
import { formatNumber, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type Column } from '@/components/shared/data-table';
import {
  StatusBadge,
  toneForPharmacyStatus,
} from '@/components/shared/status-badge';
import { PharmacyLogo } from '@/components/brand';
import type { Pharmacy } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const columns: Column<Pharmacy>[] = [
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
    key: 'plan',
    header: 'Plan',
    sortable: true,
    sortAccessor: (r) => r.plan,
    hideOnMobile: true,
    cell: (r) => (
      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
        {planLabels[r.plan]}
      </span>
    ),
  },
  {
    key: 'adminUser',
    header: 'Administrador',
    hideOnMobile: true,
    cell: (r) => (
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground">{r.adminUser.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {r.adminUser.email}
        </p>
      </div>
    ),
  },
  {
    key: 'phone',
    header: 'Teléfono',
    hideOnMobile: true,
    cell: (r) => <span className="text-muted-foreground">{r.phone}</span>,
  },
  {
    key: 'province',
    header: 'Provincia',
    sortable: true,
    sortAccessor: (r) => r.province,
    hideOnMobile: true,
    cell: (r) => r.province,
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
    key: 'products',
    header: 'Productos',
    sortable: true,
    sortAccessor: (r) => r.products,
    align: 'right',
    hideOnMobile: true,
    cell: (r) => formatNumber(r.products),
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
    key: 'actions',
    header: '',
    align: 'right',
    cell: (r) => <RowActions pharmacy={r} />,
  },
];

function RowActions({ pharmacy }: { pharmacy: Pharmacy }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          aria-label="Acciones"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{pharmacy.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push(`/farmacias/${pharmacy.id}`)}>
          <Eye className="mr-2 h-4 w-4" /> Ver ficha
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Suspender
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function FarmaciasPage() {
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [planFilter, setPlanFilter] = React.useState<string>('all');
  const router = useRouter();

  const filtered = React.useMemo(() => {
    return pharmacies.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (planFilter !== 'all' && p.plan !== planFilter) return false;
      return true;
    });
  }, [statusFilter, planFilter]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Farmacias"
        description="Gestiona todas las farmacias de tu red"
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" /> Importar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" /> Exportar
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => router.push('/farmacias/nueva')}
            >
              <Plus className="h-4 w-4" /> Nueva farmacia
            </Button>
          </>
        }
      />

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/farmacias/${r.id}`)}
        searchAccessor={(r) =>
          `${r.name} ${r.city} ${r.province} ${r.email} ${r.adminUser.name} ${r.cif}`
        }
        searchPlaceholder="Buscar por nombre, ciudad, administrador, CIF…"
        pageSize={8}
        toolbar={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[170px] text-sm">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="h-9 w-[140px] text-sm">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los planes</SelectItem>
                {Object.entries(planLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        empty={
          <div className="flex flex-col items-center gap-3 py-8">
            <Store className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No se encontraron farmacias con esos criterios.
            </p>
          </div>
        }
      />
    </div>
  );
}
