import type { PharmacyRoleKey } from '@/lib/auth/access';

const ROLE_LABELS: Record<string, string> = {
  PHARMACY_OWNER: 'Propietario',
  PHARMACY_ADMIN: 'Administrador',
  PHARMACIST: 'Farmacéutico',
  STAFF: 'Personal',
};

/**
 * Etiqueta legible para UI. La autorización sigue usando roleKey interno.
 */
export function pharmacyRoleLabel(roleKey: PharmacyRoleKey | string): string {
  return ROLE_LABELS[roleKey] ?? 'Usuario de farmacia';
}
