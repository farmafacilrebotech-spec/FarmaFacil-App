import { hasPlatformPermission } from '@/lib/auth/platform';

export async function hasKioskInventoryRead(): Promise<boolean> {
  const r = await hasPlatformPermission('platform.kiosk_inventory.read');
  return r.ok;
}

export async function hasKioskInventoryWrite(): Promise<boolean> {
  const r = await hasPlatformPermission('platform.kiosk_inventory.write');
  return r.ok;
}
