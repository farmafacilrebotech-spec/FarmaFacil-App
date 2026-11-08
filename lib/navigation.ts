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
  Mail,
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
    description: 'Cuentas cliente PWA (solo lectura)',
    superAdminOnly: true,
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
    description: 'Pedidos de farmacias (solo lectura)',
  },
  {
    label: 'Promociones',
    href: '/promociones',
    icon: Tag,
    description: 'Pendiente de esquema propio',
  },
  {
    label: 'Contratos',
    href: '/contratos',
    icon: FileText,
    description: 'Suscripciones; contratos PDF pendientes 069',
  },
  {
    label: 'Tarifas y simulador',
    href: '/tarifas',
    icon: Calculator,
    description: 'General / Personalizado / IA + presupuestos',
  },
  {
    label: 'Usuarios',
    href: '/usuarios',
    icon: UserCog,
    description: 'Gestión de usuarios',
    superAdminOnly: true,
  },
  {
    label: 'Emails',
    href: '/emails',
    icon: Mail,
    description: 'Plantillas, borradores y redacción (envío bloqueado)',
    superAdminOnly: true,
  },
  {
    label: 'Configuración',
    href: '/configuracion',
    icon: Settings,
    description: 'Mapa global / farmacia / comercial / seguridad',
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
