'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Store,
  LayoutDashboard,
  FileText,
  QrCode,
  Palette,
  Users,
  User,
  Pill,
  ShoppingCart,
  Activity,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';

import { pharmacies, planLabels, statusLabels } from '@/lib/mock-data';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  StatusBadge,
  toneForPharmacyStatus,
} from '@/components/shared/status-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GeneralTab } from '@/components/pharmacies/tabs/general-tab';
import { ContratoTab } from '@/components/pharmacies/tabs/contrato-tab';
import { QrTab } from '@/components/pharmacies/tabs/qr-tab';
import { PersonalizacionTab } from '@/components/pharmacies/tabs/personalizacion-tab';
import { UsuariosTab } from '@/components/pharmacies/tabs/usuarios-tab';
import { ClientesTab } from '@/components/pharmacies/tabs/clientes-tab';
import { CatalogoTab } from '@/components/pharmacies/tabs/catalogo-tab';
import { PedidosTab } from '@/components/pharmacies/tabs/pedidos-tab';
import { ActividadTab } from '@/components/pharmacies/tabs/actividad-tab';
import { PharmacyLogo } from '@/components/brand';

const tabs = [
  { id: 'general', label: 'General', icon: LayoutDashboard },
  { id: 'contrato', label: 'Contrato', icon: FileText },
  { id: 'qr', label: 'QR', icon: QrCode },
  { id: 'personalizacion', label: 'Personalización', icon: Palette },
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'clientes', label: 'Clientes', icon: User },
  { id: 'catalogo', label: 'Catálogo', icon: Pill },
  { id: 'pedidos', label: 'Pedidos', icon: ShoppingCart },
  { id: 'actividad', label: 'Actividad', icon: Activity },
] as const;

export default function PharmacyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const pharmacy = pharmacies.find((p) => p.id === params.id);
  const [activeTab, setActiveTab] = React.useState<string>('general');

  if (!pharmacy) {
    return (
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Store className="h-12 w-12 text-muted-foreground/40" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Farmacia no encontrada
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            La farmacia que buscas no existe o ha sido eliminada.
          </p>
          <Button asChild className="mt-5" size="sm">
            <Link href="/farmacias">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver a farmacias
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Breadcrumb back */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/farmacias"
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Farmacias
        </Link>
      </div>

      {/* Header card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <PharmacyLogo
              name={pharmacy.name}
              logoColor={pharmacy.logoColor}
              size={64}
              rounded="2xl"
              className="shadow-soft"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                  {pharmacy.name}
                </h1>
                <StatusBadge tone={toneForPharmacyStatus(pharmacy.status)}>
                  {statusLabels[pharmacy.status]}
                </StatusBadge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {pharmacy.legalName} · {pharmacy.city}, {pharmacy.province}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>
                  Plan:{' '}
                  <span className="font-medium text-foreground">
                    {planLabels[pharmacy.plan]}
                  </span>
                </span>
                <span>
                  Clientes:{' '}
                  <span className="font-medium text-foreground">
                    {formatNumber(pharmacy.clients)}
                  </span>
                </span>
                <span>
                  Productos:{' '}
                  <span className="font-medium text-foreground">
                    {formatNumber(pharmacy.products)}
                  </span>
                </span>
                <span>
                  Pedidos:{' '}
                  <span className="font-medium text-foreground">
                    {formatNumber(pharmacy.orders)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem>Exportar datos</DropdownMenuItem>
                <DropdownMenuItem>Duplicar farmacia</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Suspender farmacia
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-border px-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="animate-fade-in" key={activeTab}>
        {activeTab === 'general' && <GeneralTab pharmacy={pharmacy} />}
        {activeTab === 'contrato' && <ContratoTab pharmacy={pharmacy} />}
        {activeTab === 'qr' && <QrTab pharmacy={pharmacy} />}
        {activeTab === 'personalizacion' && (
          <PersonalizacionTab pharmacy={pharmacy} />
        )}
        {activeTab === 'usuarios' && <UsuariosTab pharmacy={pharmacy} />}
        {activeTab === 'clientes' && <ClientesTab />}
        {activeTab === 'catalogo' && <CatalogoTab />}
        {activeTab === 'pedidos' && <PedidosTab />}
        {activeTab === 'actividad' && (
          <ActividadTab activity={pharmacy.activity} />
        )}
      </div>
    </div>
  );
}
