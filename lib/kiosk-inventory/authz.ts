import { hasPlatformPermission } from '@/lib/auth/platform';

export async function hasKioskInventoryRead(): Promise<boolean> {
  const r = await hasPlatformPermission('platform.kiosk_inventory.read');
  return r.ok;
}

export async function hasKioskInventoryWrite(): Promise<boolean> {
  const r = await hasPlatformPermission('platform.kiosk_inventory.write');
  return r.ok;
}

/** Importes y documentos de compra (presupuestos/facturas). No se concede a soporte. */
export async function hasKioskPurchasingRead(): Promise<boolean> {
  const r = await hasPlatformPermission('platform.kiosk_purchasing.read');
  return r.ok;
}

export async function hasKioskPurchasingWrite(): Promise<boolean> {
  const r = await hasPlatformPermission('platform.kiosk_purchasing.write');
  return r.ok;
}

export async function hasSuppliersRead(): Promise<boolean> {
  const r = await hasPlatformPermission('platform.suppliers.read');
  return r.ok;
}

export async function hasSuppliersWrite(): Promise<boolean> {
  const r = await hasPlatformPermission('platform.suppliers.write');
  return r.ok;
}
