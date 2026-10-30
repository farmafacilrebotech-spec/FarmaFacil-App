import {
  LayoutDashboard,
  Store,
  Users,
  Pill,
  ShoppingCart,
  Tag,
  FileText,
  Settings,
  UserCog,
  LifeBuoy,
  Calculator,
  MonitorSmartphone,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  superAdminOnly?: boolean;
  /** Visible para rol soporte (inventario técnico). */
  supportVisible?: boolean;
}

export const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'Resumen general',
  },
  {
    label: 'Farmacias',
    href: '/farmacias',
    icon: Store,
    description: 'Gestión de farmacias',
    supportVisible: true,
  },
  {
    label: 'Inventario kioskos',
    href: '/inventario-kioskos',
    icon: MonitorSmartphone,
    description: 'Activos físicos KSK-…',
    supportVisible: true,
  },
  {
    label: 'Clientes',
    href: '/clientes',
    icon: Users,
    description: 'Base de clientes',
  },
  {
    label: 'Catálogo',
    href: '/catalogo',
    icon: Pill,
    description: 'Catálogo maestro FarmaFácil',
  },
  {
    label: 'Pedidos',
    href: '/pedidos',
    icon: ShoppingCart,
    description: 'Pedidos y estados',
  },
  {
    label: 'Promociones',
    href: '/promociones',
    icon: Tag,
    description: 'Campañas y descuentos',
  },
  {
    label: 'Contratos',
    href: '/contratos',
    icon: FileText,
    description: 'Contratos y firmas',
  },
  {
    label: 'Tarifas y simulador',
    href: '/tarifas',
    icon: Calculator,
    description: 'Planes, presupuestos y pilotos',
  },
  {
    label: 'Usuarios',
    href: '/usuarios',
    icon: UserCog,
    description: 'Gestión de usuarios',
    superAdminOnly: true,
  },
  {
    label: 'Configuración',
    href: '/configuracion',
    icon: Settings,
    description: 'Ajustes de la cuenta',
  },
];

/** Nav del shell según alcance de plataforma. */
export function navItemsForPlatformScope(
  scope: 'superadmin' | 'support'
): NavItem[] {
  if (scope === 'support') {
    return navItems.filter((item) => item.supportVisible);
  }
  // SuperAdmin: menú completo (incl. entradas superAdminOnly).
  return navItems;
}

export const helpItems: NavItem[] = [
  {
    label: 'Centro de ayuda',
    href: '/ayuda',
    icon: LifeBuoy,
  },
];
