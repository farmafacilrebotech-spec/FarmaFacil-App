import {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  Users,
  Tag,
  Bot,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type TenantNavItem = {
  label: string;
  /** Segmento bajo /f/[pharmacyId]/ */
  segment: string;
  icon: LucideIcon;
  description?: string;
};

export const tenantNavItems: TenantNavItem[] = [
  {
    label: 'Dashboard',
    segment: 'dashboard',
    icon: LayoutDashboard,
    description: 'Resumen de tu farmacia',
  },
  {
    label: 'Pedidos',
    segment: 'pedidos',
    icon: ShoppingCart,
    description: 'Pedidos y estados',
  },
  {
    label: 'Catálogo',
    segment: 'catalogo',
    icon: Pill,
    description: 'Productos y stock',
  },
  {
    label: 'Clientes',
    segment: 'clientes',
    icon: Users,
    description: 'Base de clientes',
  },
  {
    label: 'Promociones',
    segment: 'promociones',
    icon: Tag,
    description: 'Campañas y descuentos',
  },
  {
    label: 'Asistente',
    segment: 'asistente',
    icon: Bot,
    description: 'Asistente de farmacia',
  },
  {
    label: 'Configuración',
    segment: 'configuracion',
    icon: Settings,
    description: 'Ajustes de la farmacia',
  },
];

export function tenantHref(pharmacyId: string, segment: string): string {
  return `/f/${pharmacyId}/${segment}`;
}
