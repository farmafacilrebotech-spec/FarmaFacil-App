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
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description?: string;
  superAdminOnly?: boolean;
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
    description: 'Productos y stock',
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

export const helpItems: NavItem[] = [
  {
    label: 'Centro de ayuda',
    href: '/ayuda',
    icon: LifeBuoy,
  },
];
