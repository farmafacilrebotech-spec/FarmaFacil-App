'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, MoreHorizontal, Plus, Store } from 'lucide-react';

import type { PharmacyListItem } from '@/lib/pharmacies/types';
import { PHARMACY_STATUS_LABELS } from '@/lib/pharmacies/labels';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/shared/data-table';
import {
  StatusBadge,
  toneForPharmacyStatus,
} from '@/components/shared/status-badge';
import { PharmacyLogo } from '@/components/brand';
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

function RowActions({ pharmacy }: { pharmacy: PharmacyListItem }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          aria-label="Acciones"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{pharmacy.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push(`/farmacias/${pharmacy.id}`)}
        >
          <Eye className="mr-2 h-4 w-4" /> Ver ficha
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columns: Column<PharmacyListItem>[] = [
  {
    key: 'name',
    header: 'Farmacia',
    sortable: true,
    sortAccessor: (r) => r.name,
    cell: (r) => (
      <div className="flex items-center gap-3">
        <PharmacyLogo
          name={r.name}
          logoColor={r.logo_color || '#2EC4C7'}
          size={36}
        />
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[r.city, r.province].filter(Boolean).join(', ') || '—'}
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
        {PHARMACY_STATUS_LABELS[r.status] ?? r.status}
      </StatusBadge>
    ),
  },
  {
    key: 'plan',
    header: 'Plan',
    sortable: true,
    sortAccessor: (r) => r.plan?.name ?? '',
    cell: (r) => (
      <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground">
        {r.plan?.name ?? '—'}
      </span>
    ),
  },
  {
    key: 'cif',
    header: 'CIF',
    cell: (r) => (
      <span className="text-muted-foreground">{r.cif || '—'}</span>
    ),
  },
  {
    key: 'email',
    header: 'Email',
    cell: (r) => (
      <span className="truncate text-muted-foreground">{r.email || '—'}</span>
    ),
  },
  {
    key: 'phone',
    header: 'Teléfono',
    cell: (r) => (
      <span className="text-muted-foreground">{r.phone || '—'}</span>
    ),
  },
  {
    key: 'created_at',
    header: 'Alta',
    sortable: true,
    sortAccessor: (r) => r.created_at,
    cell: (r) => formatDate(r.created_at),
  },
  {
    key: 'actions',
    header: '',
    align: 'right',
    cell: (r) => <RowActions pharmacy={r} />,
  },
];

export function PharmaciesTable({
  pharmacies,
}: {
  pharmacies: PharmacyListItem[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [planFilter, setPlanFilter] = React.useState('all');

  const planOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pharmacies) {
      if (p.plan) map.set(p.plan.key, p.plan.name);
    }
    return Array.from(map.entries());
  }, [pharmacies]);

  const statusOptions = React.useMemo(() => {
    return Array.from(new Set(pharmacies.map((p) => p.status)));
  }, [pharmacies]);

  const filtered = React.useMemo(() => {
    return pharmacies.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (planFilter !== 'all' && p.plan?.key !== planFilter) return false;
      return true;
    });
  }, [pharmacies, statusFilter, planFilter]);

  if (pharmacies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <Store className="h-10 w-10 text-muted-foreground/40" />
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          Todavía no hay farmacias
        </h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Crea la primera farmacia para empezar a gestionar tu red en FarmaFácil.
        </p>
        <Button asChild size="sm" className="mt-5 gap-1.5">
          <Link href="/farmacias/nueva">
            <Plus className="h-4 w-4" /> Nueva farmacia
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={filtered}
      rowKey={(r) => r.id}
      onRowClick={(r) => router.push(`/farmacias/${r.id}`)}
      searchAccessor={(r) =>
        `${r.name} ${r.city ?? ''} ${r.province ?? ''} ${r.email ?? ''} ${r.cif ?? ''}`
      }
      searchPlaceholder="Buscar por nombre, ciudad, email, CIF…"
      pageSize={8}
      toolbar={
        <>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[190px] text-sm">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {statusOptions.map((k) => (
                <SelectItem key={k} value={k}>
                  {PHARMACY_STATUS_LABELS[k] ?? k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="h-9 w-[160px] text-sm">
              <SelectValue placeholder="Plan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los planes</SelectItem>
              {planOptions.map(([key, name]) => (
                <SelectItem key={key} value={key}>
                  {name}
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
  );
}
