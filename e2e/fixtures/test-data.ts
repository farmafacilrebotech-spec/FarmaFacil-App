/**
 * Datos de prueba controlados (staging dazfdcjscnpfvhcyjddt).
 * Credenciales viven en `.env.e2e.local` (no en el repo).
 */

export const STAGING_PROJECT = 'dazfdcjscnpfvhcyjddt';

export const PHARMACIES = {
  fase7: {
    id: '98ea2742-5b57-4271-8448-b132cae70598',
    name: 'TEST Fase7 QR Requests 20261021',
    publicId: '2mo6cq0yjss6ratr',
  },
  staging1: {
    id: '187c908e-1f21-4db9-92f4-eae0e79ad2a2',
    name: 'Farmacia Staging 1',
    publicId: '91dntkqzz29hscvt',
  },
} as const;

/** Pedidos históricos a conservar (solo lectura en E2E). */
export const HISTORIC_ORDERS = ['0029', '0033', '0034', '0035'] as const;

export type E2ERole =
  | 'superadmin'
  | 'owner'
  | 'admin'
  | 'pharmacist'
  | 'staff'
  | 'customer'
  | 'customerB'
  | 'outsider';

export function roleEmail(role: E2ERole): string {
  const map: Record<E2ERole, string> = {
    superadmin:
      process.env.E2E_SA_EMAIL || 'emails.sa.075-emails-stage@farmafacil.test',
    owner: process.env.E2E_OWNER_EMAIL || 'catalog.owner.074@farmafacil.test',
    admin: process.env.E2E_ADMIN_EMAIL || 'catalog.admin.074@farmafacil.test',
    pharmacist:
      process.env.E2E_PHARMACIST_EMAIL ||
      'catalog.pharmacist.074@farmafacil.test',
    staff: process.env.E2E_STAFF_EMAIL || 'catalog.staff.074@farmafacil.test',
    customer:
      process.env.E2E_CUSTOMER_EMAIL || 'cliente.test3070@farmafacil.test',
    customerB:
      process.env.E2E_CUSTOMER_B_EMAIL || 'lab.cliente.b.clientsqr@farmafacil.test',
    outsider:
      process.env.E2E_OUTSIDER_EMAIL || 'catalog.outsider.074@farmafacil.test',
  };
  return map[role];
}

export function e2ePassword(): string {
  const pwd = process.env.E2E_PASSWORD;
  if (!pwd) {
    throw new Error(
      'Falta E2E_PASSWORD. Ejecuta: npm run test:e2e:prepare'
    );
  }
  return pwd;
}
