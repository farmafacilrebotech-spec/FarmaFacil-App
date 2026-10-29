import { createClient } from '@/lib/supabase/server';
import { hasKioskInventoryRead } from '@/lib/kiosk-inventory/authz';
import type {
  KioskAssetAssignment,
  KioskAssetDetail,
  KioskAssetInsurance,
  KioskAssetStatus,
  KioskAssetSummary,
  KioskInventoryCounts,
} from '@/lib/kiosk-inventory/types';

function mapStatus(raw: string | null | undefined): KioskAssetStatus {
  if (
    raw === 'pending_identification' ||
    raw === 'warehouse' ||
    raw === 'assigned' ||
    raw === 'repair' ||
    raw === 'retired'
  ) {
    return raw;
  }
  return 'pending_identification';
}

function mapAsset(
  row: Record<string, unknown>,
  pharmacyName: string | null,
  activePolicyRef: string | null
): KioskAssetSummary {
  const equipmentSerial = (row.equipment_serial as string | null) ?? null;
  const status = mapStatus(row.status as string);
  return {
    id: String(row.id),
    assetCode: String(row.asset_code),
    equipmentSerial,
    model: (row.model as string | null) ?? null,
    vendor: (row.vendor as string | null) ?? null,
    receivedAt: (row.received_at as string | null) ?? null,
    purchaseOrderRef: (row.purchase_order_ref as string | null) ?? null,
    status,
    currentPharmacyId: (row.current_pharmacy_id as string | null) ?? null,
    currentPharmacyName: pharmacyName,
    pairedDeviceId: (row.paired_device_id as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    activePolicyRef,
    needsIdentification: !equipmentSerial,
  };
}

const ASSET_SELECT = `
  id, asset_code, equipment_serial, model, vendor, received_at,
  purchase_order_ref, status, current_pharmacy_id, paired_device_id,
  notes, created_at, updated_at,
  pharmacies:current_pharmacy_id ( name )
`;

export async function getKioskInventoryCounts(): Promise<KioskInventoryCounts | null> {
  if (!(await hasKioskInventoryRead())) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from('kiosk_assets')
    .select('status, equipment_serial');

  if (error) {
    console.error('[kiosk-inventory] counts', error.code, error.message);
    return null;
  }

  const counts: KioskInventoryCounts = {
    total: 0,
    pendingIdentification: 0,
    warehouse: 0,
    assigned: 0,
    repair: 0,
    retired: 0,
    needsSerial: 0,
  };
  for (const row of data ?? []) {
    counts.total += 1;
    const s = mapStatus((row as { status?: string }).status);
    if (s === 'pending_identification') counts.pendingIdentification += 1;
    else if (s === 'warehouse') counts.warehouse += 1;
    else if (s === 'assigned') counts.assigned += 1;
    else if (s === 'repair') counts.repair += 1;
    else if (s === 'retired') counts.retired += 1;
    if (!(row as { equipment_serial?: string | null }).equipment_serial) {
      counts.needsSerial += 1;
    }
  }
  return counts;
}

export async function listKioskAssets(input?: {
  query?: string;
  status?: KioskAssetStatus | 'all' | 'needs_serial';
  pharmacyId?: string | null;
}): Promise<KioskAssetSummary[]> {
  if (!(await hasKioskInventoryRead())) return [];

  const supabase = createClient();
  let q = supabase
    .from('kiosk_assets')
    .select(ASSET_SELECT)
    .order('asset_code', { ascending: true });

  if (input?.status === 'needs_serial') {
    q = q.is('equipment_serial', null);
  } else if (input?.status && input.status !== 'all') {
    q = q.eq('status', input.status);
  }
  if (input?.pharmacyId) {
    q = q.eq('current_pharmacy_id', input.pharmacyId);
  }

  const { data, error } = await q;
  if (error) {
    console.error('[kiosk-inventory] list', error.code, error.message);
    return [];
  }

  const query = (input?.query ?? '').trim().toLowerCase();
  const rows = (data ?? []) as Record<string, unknown>[];

  const assetIds = rows.map((r) => String(r.id));
  const policyByAsset = new Map<string, string>();
  if (assetIds.length > 0) {
    const { data: policies } = await supabase
      .from('kiosk_asset_insurance_coverages')
      .select('asset_id, policy_ref')
      .in('asset_id', assetIds)
      .is('coverage_end', null);
    for (const p of policies ?? []) {
      policyByAsset.set(String(p.asset_id), String(p.policy_ref));
    }
  }

  const mapped = rows.map((row) => {
    const pharmacy = row.pharmacies as
      | { name?: string }
      | { name?: string }[]
      | null;
    const name = Array.isArray(pharmacy)
      ? pharmacy[0]?.name ?? null
      : pharmacy?.name ?? null;
    return mapAsset(row, name, policyByAsset.get(String(row.id)) ?? null);
  });

  if (!query) return mapped;
  return mapped.filter((a) => {
    const hay = [
      a.assetCode,
      a.equipmentSerial,
      a.model,
      a.vendor,
      a.purchaseOrderRef,
      a.currentPharmacyName,
      a.activePolicyRef,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(query);
  });
}

export async function getKioskAssetDetail(
  assetId: string
): Promise<KioskAssetDetail | null> {
  if (!(await hasKioskInventoryRead())) return null;
  const supabase = createClient();

  const { data, error } = await supabase
    .from('kiosk_assets')
    .select(ASSET_SELECT)
    .eq('id', assetId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[kiosk-inventory] detail', error.code, error.message);
    return null;
  }

  return hydrateDetail(data as Record<string, unknown>);
}

export async function getKioskAssetDetailByCode(
  assetCode: string
): Promise<KioskAssetDetail | null> {
  if (!(await hasKioskInventoryRead())) return null;
  const code = assetCode.trim().toUpperCase();
  if (!/^KSK-[0-9]{4,}$/.test(code)) return null;

  const supabase = createClient();
  const { data, error } = await supabase
    .from('kiosk_assets')
    .select(ASSET_SELECT)
    .eq('asset_code', code)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[kiosk-inventory] by code', error.code, error.message);
    return null;
  }
  return hydrateDetail(data as Record<string, unknown>);
}

async function hydrateDetail(
  data: Record<string, unknown>
): Promise<KioskAssetDetail> {
  const supabase = createClient();
  const assetId = String(data.id);

  const pharmacy = data.pharmacies as
    | { name?: string }
    | { name?: string }[]
    | null
    | undefined;
  const pharmacyName = Array.isArray(pharmacy)
    ? pharmacy[0]?.name ?? null
    : pharmacy?.name ?? null;

  const [{ data: assignments }, { data: coverages }] = await Promise.all([
    supabase
      .from('kiosk_asset_assignments')
      .select(
        `
        id, pharmacy_id, pharmacy_device_id, started_at, shipped_at, installed_at,
        ended_at, end_reason, created_by,
        pharmacies:pharmacy_id ( name )
      `
      )
      .eq('asset_id', assetId)
      .order('started_at', { ascending: false }),
    supabase
      .from('kiosk_asset_insurance_coverages')
      .select(
        'id, policy_ref, insurer_name, coverage_start, coverage_end, notes, created_at, created_by'
      )
      .eq('asset_id', assetId)
      .order('coverage_start', { ascending: false }),
  ]);

  const assignmentRows: KioskAssetAssignment[] = (assignments ?? []).map((a) => {
    const ph = a.pharmacies as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(ph) ? ph[0]?.name ?? null : ph?.name ?? null;
    return {
      id: a.id as string,
      pharmacyId: a.pharmacy_id as string,
      pharmacyName: name,
      pharmacyDeviceId: (a.pharmacy_device_id as string | null) ?? null,
      startedAt: a.started_at as string,
      shippedAt: (a.shipped_at as string | null) ?? null,
      installedAt: (a.installed_at as string | null) ?? null,
      endedAt: (a.ended_at as string | null) ?? null,
      endReason: (a.end_reason as string | null) ?? null,
      createdBy: (a.created_by as string | null) ?? null,
    };
  });

  const insuranceRows: KioskAssetInsurance[] = (coverages ?? []).map((c) => ({
    id: c.id as string,
    policyRef: c.policy_ref as string,
    insurerName: (c.insurer_name as string | null) ?? null,
    coverageStart: c.coverage_start as string,
    coverageEnd: (c.coverage_end as string | null) ?? null,
    notes: (c.notes as string | null) ?? null,
    createdAt: c.created_at as string,
    createdBy: (c.created_by as string | null) ?? null,
  }));

  const activePolicy =
    insuranceRows.find((c) => !c.coverageEnd)?.policyRef ?? null;

  return {
    ...mapAsset(data, pharmacyName, activePolicy),
    assignments: assignmentRows,
    insuranceCoverages: insuranceRows,
  };
}
