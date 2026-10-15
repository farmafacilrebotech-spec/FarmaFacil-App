import { createClient } from '@/lib/supabase/server';
import { requireKioskDevicesView } from '@/lib/kiosk/authz';

export type KioskDeviceRow = {
  id: string;
  pharmacyId: string;
  displayName: string;
  status: 'active' | 'revoked';
  pairedAt: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
  userAgent: string | null;
};

export async function listPharmacyKioskDevices(
  pharmacyId: string
): Promise<
  | { ok: true; devices: KioskDeviceRow[] }
  | { ok: false; error: string }
> {
  const auth = await requireKioskDevicesView(pharmacyId);
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('pharmacy_devices')
    .select(
      'id, pharmacy_id, display_name, status, paired_at, revoked_at, last_seen_at, user_agent'
    )
    .eq('pharmacy_id', pharmacyId)
    .order('paired_at', { ascending: false });

  if (error) {
    console.error('[kiosk] list devices', error.message);
    return {
      ok: false,
      error: 'No se han podido cargar los dispositivos kiosko.',
    };
  }

  const devices: KioskDeviceRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    pharmacyId: row.pharmacy_id as string,
    displayName: row.display_name as string,
    status: row.status as 'active' | 'revoked',
    pairedAt: row.paired_at as string,
    revokedAt: (row.revoked_at as string | null) ?? null,
    lastSeenAt: (row.last_seen_at as string | null) ?? null,
    userAgent: (row.user_agent as string | null) ?? null,
  }));

  return { ok: true, devices };
}
