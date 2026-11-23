/**
 * Predicados de rol puros (sin I/O) para clientes y QR del panel tenant.
 */

const CLIENTS_ROLES = new Set<string>([
  'PHARMACY_OWNER',
  'PHARMACY_ADMIN',
  'PHARMACIST',
]);

const QR_ROLES = new Set<string>(['PHARMACY_OWNER', 'PHARMACY_ADMIN']);

/** Usuarios y kiosko: solo Owner/Admin (memberships.manage / kiosk.devices.*). */
const USERS_AND_KIOSK_ROLES = new Set<string>([
  'PHARMACY_OWNER',
  'PHARMACY_ADMIN',
]);

export function roleCanViewPharmacyClients(roleKey: string): boolean {
  return CLIENTS_ROLES.has(String(roleKey));
}

export function roleCanManagePharmacyQr(roleKey: string): boolean {
  return QR_ROLES.has(String(roleKey));
}

export function roleCanManagePharmacyUsers(roleKey: string): boolean {
  return USERS_AND_KIOSK_ROLES.has(String(roleKey));
}

export function roleCanManagePharmacyKiosk(roleKey: string): boolean {
  return USERS_AND_KIOSK_ROLES.has(String(roleKey));
}

const NAV_GATES: Record<string, (roleKey: string) => boolean> = {
  clientes: roleCanViewPharmacyClients,
  qr: roleCanManagePharmacyQr,
  usuarios: roleCanManagePharmacyUsers,
  dispositivos: roleCanManagePharmacyKiosk,
};

/** Visibilidad de segmentos del menú tenant según el rol activo. */
export function isTenantNavSegmentVisible(
  segment: string,
  roleKey: string
): boolean {
  const gate = NAV_GATES[segment];
  return gate ? gate(roleKey) : true;
}
