export type PharmacyStatus =
  | 'draft'
  | 'pending_contract'
  | 'contract_sent'
  | 'contract_signed'
  | 'pending_setup'
  | 'active'
  | 'suspended';

export type Plan = 'starter' | 'pro' | 'business' | 'enterprise';
export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'prepared'
  | 'delivered'
  | 'cancelled';
export type ContractStatus =
  | 'none'
  | 'draft'
  | 'sent'
  | 'signed'
  | 'expiring'
  | 'expired';

export interface PharmacyUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  status: 'active' | 'invited' | 'disabled';
  lastAccess: string | null;
}

export interface Pharmacy {
  id: string;
  name: string;
  legalName: string;
  cif: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  email: string;
  phone: string;
  web: string;
  status: PharmacyStatus;
  plan: Plan;
  clients: number;
  products: number;
  orders: number;
  monthlyRevenue: number;
  joinedAt: string; // ISO
  logoColor: string;
  adminUser: {
    name: string;
    email: string;
    phone: string;
  };
  contract: {
    status: ContractStatus;
    version: string;
    sentAt: string | null;
    signedAt: string | null;
    renewalAt: string | null;
  };
  qr: {
    url: string;
    code: string;
  };
  customization: {
    primaryColor: string;
    secondaryColor: string;
    welcomeMessage: string;
    schedule: string;
    whatsapp: string;
  };
  users: PharmacyUser[];
  activity: PharmacyActivityItem[];
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  pharmacyId: string;
  pharmacyName: string;
  orders: number;
  totalSpent: number;
  lastOrderAt: string | null;
  status: 'active' | 'inactive';
  tags: string[];
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  pharmacyId: string;
  featured: boolean;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface Order {
  id: string;
  code: string;
  clientName: string;
  pharmacyId: string;
  pharmacyName: string;
  status: OrderStatus;
  total: number;
  items: number;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: 'order' | 'client' | 'pharmacy' | 'payment' | 'alert';
  title: string;
  description: string;
  time: string;
}

export interface PharmacyActivityItem {
  id: string;
  type: 'contract' | 'logo' | 'qr' | 'user' | 'order' | 'payment' | 'config';
  title: string;
  description: string;
  time: string;
  user: string;
}

export interface KpiPoint {
  label: string;
  value: string;
  delta: number; // percentage
  trend: number[];
  icon: 'pharmacy' | 'clients' | 'orders' | 'revenue' | 'today' | 'products';
}

/* ------------------------------------------------------------------ */
/*  User management                                                   */
/* ------------------------------------------------------------------ */

export type UserRole = 'superadmin' | 'pharmacy_admin' | 'employee' | 'client';
export type UserStatus =
  | 'active'
  | 'pending'
  | 'suspended'
  | 'invite_sent'
  | 'invite_accepted';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  pharmacyId: string | null;
  pharmacyName: string | null;
  status: UserStatus;
  lastAccess: string | null;
  createdAt: string;
  avatarColor: string;
  activity: UserActivityItem[];
  permissions: Record<string, boolean>;
}

export interface UserActivityItem {
  id: string;
  type: 'login' | 'logout' | 'create' | 'update' | 'delete' | 'invite' | 'config';
  title: string;
  description: string;
  time: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  description: string;
  permissions: { id: string; label: string; description: string }[];
}
